import { getRuntimeEnv } from "@/db";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";

export type TradingMode = "paper" | "live";
export type ProposalDecision = "approved" | "denied";

const BOT_ID = "signal-desk-local";
const MAX_JSON_BYTES = 64 * 1024;

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new RequestError("Content-Type must be application/json", 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_JSON_BYTES) {
    throw new RequestError("Request body is too large", 413);
  }
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError("JSON body must be an object");
  }
  return value as Record<string, unknown>;
}

export async function requireBrowserWrite(request: Request): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) throw new RequestError("Sign in with ChatGPT to continue", 401);

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new RequestError("Invalid request origin", 403);
    }
    if (originHost !== host) throw new RequestError("Cross-origin writes are not allowed", 403);
  }
  return user;
}

export async function requireBot(request: Request): Promise<void> {
  const expected = getRuntimeEnv().BOT_API_TOKEN?.trim();
  if (!expected || expected.length < 32) {
    throw new RequestError("Bot API authentication is not configured", 503);
  }
  if (request.headers.get("x-signal-desk-bot") !== BOT_ID) {
    throw new RequestError("Bot identity is missing", 401);
  }
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!supplied || !(await timingSafeEqual(supplied, expected))) {
    throw new RequestError("Bot authentication failed", 401);
  }
}

async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftDigest);
  const b = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export function asString(
  value: unknown,
  field: string,
  options: { max?: number; optional?: boolean } = {},
): string | null {
  if (value === undefined || value === null) {
    if (options.optional) return null;
    throw new RequestError(`${field} is required`);
  }
  if (typeof value !== "string") throw new RequestError(`${field} must be a string`);
  const result = value.trim();
  if (!result && !options.optional) throw new RequestError(`${field} is required`);
  if (result.length > (options.max ?? 500)) throw new RequestError(`${field} is too long`);
  return result || null;
}

export function asInteger(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; optional?: boolean } = {},
): number | null {
  if (value === undefined || value === null) {
    if (options.optional) return null;
    throw new RequestError(`${field} is required`);
  }
  if (!Number.isSafeInteger(value)) throw new RequestError(`${field} must be an integer`);
  const result = value as number;
  if (options.min !== undefined && result < options.min) throw new RequestError(`${field} is too small`);
  if (options.max !== undefined && result > options.max) throw new RequestError(`${field} is too large`);
  return result;
}

export function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new RequestError(`${field} must be a boolean`);
  return value;
}

export function asMode(value: unknown, field = "mode"): TradingMode {
  if (value !== "paper" && value !== "live") throw new RequestError(`${field} must be paper or live`);
  return value;
}

export function asIsoTimestamp(
  value: unknown,
  field: string,
  options: { future?: boolean; maxFutureMs?: number; maxPastMs?: number } = {},
): string {
  const raw = asString(value, field, { max: 40 });
  const time = Date.parse(raw as string);
  if (!Number.isFinite(time)) throw new RequestError(`${field} must be an ISO timestamp`);
  const now = Date.now();
  if (options.future && time <= now) throw new RequestError(`${field} must be in the future`);
  if (options.maxFutureMs !== undefined && time > now + options.maxFutureMs) {
    throw new RequestError(`${field} is too far in the future`);
  }
  if (options.maxPastMs !== undefined && time < now - options.maxPastMs) {
    throw new RequestError(`${field} is stale`);
  }
  return new Date(time).toISOString();
}

export type NormalizedProposal = {
  id: string;
  mode: TradingMode;
  accountLabel: string;
  symbol: string;
  strategy: string;
  side: "buy" | "sell";
  instrumentId: string;
  optionType: "call" | "put";
  expiration: string;
  strikeCents: number;
  quantity: number;
  limitPriceCents: number;
  maxLossCents: number;
  rationale: string;
  exitPlan: string;
  brokerReviewId: string | null;
  brokerAlertsJson: string;
  quoteTimestamp: string;
  expiresAt: string;
  sourceRunId: string;
};

const LIVE_STRATEGIES = new Set(["long_call", "long_put", "covered_call", "cash_secured_put"]);
const PAPER_STRATEGIES = new Set([...LIVE_STRATEGIES, "research_spread"]);

export function normalizeProposalInput(input: Record<string, unknown>): NormalizedProposal {
  const id = asString(input.id, "id", { max: 100 }) as string;
  if (!/^[A-Za-z0-9:_-]+$/.test(id)) throw new RequestError("id contains unsupported characters");
  const mode = asMode(input.mode);
  const strategy = asString(input.strategy, "strategy", { max: 40 }) as string;
  if (!(mode === "live" ? LIVE_STRATEGIES : PAPER_STRATEGIES).has(strategy)) {
    throw new RequestError(
      mode === "live"
        ? "Live proposals must be a supported single-leg Level 2 strategy"
        : "Unsupported paper strategy",
    );
  }
  const side = asString(input.side, "side", { max: 4 });
  if (side !== "buy" && side !== "sell") throw new RequestError("side must be buy or sell");
  const optionType = asString(input.optionType, "optionType", { max: 4 });
  if (optionType !== "call" && optionType !== "put") throw new RequestError("optionType must be call or put");

  const brokerAlerts = input.brokerAlerts ?? [];
  if (!Array.isArray(brokerAlerts) || brokerAlerts.length > 10) {
    throw new RequestError("brokerAlerts must be an array with at most 10 entries");
  }
  const alertStrings = brokerAlerts.map((alert, index) =>
    asString(alert, `brokerAlerts[${index}]`, { max: 300 }) as string,
  );
  const brokerReviewId = asString(input.brokerReviewId, "brokerReviewId", {
    max: 150,
    optional: true,
  });
  if (mode === "live" && !brokerReviewId) {
    throw new RequestError("Live proposals require a Robinhood broker review id");
  }

  const symbol = (asString(input.symbol, "symbol", { max: 12 }) as string).toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol)) throw new RequestError("symbol is invalid");

  return {
    id,
    mode,
    accountLabel: asString(input.accountLabel, "accountLabel", { max: 80 }) as string,
    symbol,
    strategy,
    side,
    instrumentId: asString(input.instrumentId, "instrumentId", { max: 180 }) as string,
    optionType,
    expiration: asIsoDate(input.expiration, "expiration"),
    strikeCents: asInteger(input.strikeCents, "strikeCents", { min: 1 }) as number,
    quantity: asInteger(input.quantity, "quantity", { min: 1, max: 100 }) as number,
    limitPriceCents: asInteger(input.limitPriceCents, "limitPriceCents", { min: 1 }) as number,
    maxLossCents: asInteger(input.maxLossCents, "maxLossCents", { min: 1 }) as number,
    rationale: asString(input.rationale, "rationale", { max: 1200 }) as string,
    exitPlan: asString(input.exitPlan, "exitPlan", { max: 800 }) as string,
    brokerReviewId,
    brokerAlertsJson: JSON.stringify(alertStrings),
    quoteTimestamp: asIsoTimestamp(input.quoteTimestamp, "quoteTimestamp", { maxPastMs: 120_000, maxFutureMs: 30_000 }),
    expiresAt: asIsoTimestamp(input.expiresAt, "expiresAt", { future: true, maxFutureMs: 15 * 60_000 }),
    sourceRunId: asString(input.sourceRunId, "sourceRunId", { max: 100 }) as string,
  };
}

function asIsoDate(value: unknown, field: string): string {
  const raw = asString(value, field, { max: 10 }) as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new RequestError(`${field} must use YYYY-MM-DD`);
  }
  return raw;
}

export async function proposalMaterialHash(proposal: NormalizedProposal): Promise<string> {
  const material = {
    mode: proposal.mode,
    accountLabel: proposal.accountLabel,
    symbol: proposal.symbol,
    strategy: proposal.strategy,
    side: proposal.side,
    instrumentId: proposal.instrumentId,
    optionType: proposal.optionType,
    expiration: proposal.expiration,
    strikeCents: proposal.strikeCents,
    quantity: proposal.quantity,
    limitPriceCents: proposal.limitPriceCents,
    maxLossCents: proposal.maxLossCents,
    rationale: proposal.rationale,
    exitPlan: proposal.exitPlan,
    brokerReviewId: proposal.brokerReviewId,
    brokerAlertsJson: proposal.brokerAlertsJson,
    quoteTimestamp: proposal.quoteTimestamp,
    expiresAt: proposal.expiresAt,
    sourceRunId: proposal.sourceRunId,
  };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(material)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function routeError(error: unknown): Response {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const publicMessage = /no such table/i.test(message)
    ? "Dashboard storage is not initialized. Apply the generated D1 migration."
    : "The dashboard could not complete this request.";
  return Response.json({ error: publicMessage }, { status: 500 });
}

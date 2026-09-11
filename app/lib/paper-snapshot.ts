/** Versioned, complete paper-session projection. No field confers trading authority. */
export type PaperPosition = {
  id: string; instrument_id: string; asset_class: "equity" | "etf" | "option" | "crypto";
  symbol: string; quantity: string; entry_price: string; mark_price: string;
  market_value_cents: number; cost_basis_cents: number; unrealized_pnl_cents: number; updated_at: string;
};
export type PaperDecision = {
  id: string; symbol: string | null; action: string; outcome: string; message: string;
  occurred_at: string; allocation_bps: number | null;
};
export type PaperSnapshot = {
  protocol_version: 2; session_id: string; run_id: string; sequence: number; captured_at: string;
  account: {
    initial_cash_cents: number; cash_cents: number; reserved_cash_cents: number; equity_cents: number;
    realized_pnl_cents: number; unrealized_pnl_cents: number; exposure_cents: number;
    peak_equity_cents: number; drawdown_cents: number;
  };
  positions: PaperPosition[]; decisions: PaperDecision[];
  coverage: {
    status: "NOT_STARTED" | "PARTIAL" | "COMPLETE" | "FAILED"; asset_classes: string[];
    scanned: number; candidates: number; truncated: boolean; as_of: string | null; detail: string;
  };
  health: {
    status: "PAUSED" | "RESEARCHING" | "SIMULATING" | "NO_TRADE" | "DATA_STALE" | "DISCONNECTED" | "RECOVERY_REQUIRED";
    execution_paused: boolean; research_paused: boolean; kill_switch: boolean;
    detail: string; source_at: string | null;
  };
};
export class SnapshotError extends Error {}
const MAX_CENTS = 100_000_000_000;
const assets = ["equity", "etf", "option", "crypto"];

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SnapshotError("Expected a complete object");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some((key) => !(key in row))) throw new SnapshotError("Missing or unknown snapshot fields");
  return row;
}
function string(value: unknown, max = 100): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new SnapshotError("Invalid snapshot text");
  return value;
}
function id(value: unknown): string {
  const result = string(value);
  if (!/^[A-Za-z0-9:_-]+$/.test(result)) throw new SnapshotError("Invalid snapshot identity");
  return result;
}
function integer(value: unknown, min = 0, max = MAX_CENTS): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new SnapshotError("Invalid snapshot integer");
  return value as number;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new SnapshotError("Invalid snapshot boolean");
  return value;
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new SnapshotError("Unknown snapshot status or asset class");
  return value as T;
}
function timestamp(value: unknown): string {
  const result = string(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(result) || !Number.isFinite(Date.parse(result))) throw new SnapshotError("Invalid UTC timestamp");
  return new Date(result).toISOString();
}
function decimal(value: unknown, zero = false): string {
  const result = string(value, 40);
  if (!/^(0|[1-9]\d{0,12})(\.\d{1,12})?$/.test(result) || (!zero && Number(result) <= 0)) throw new SnapshotError("Invalid positive decimal");
  return result;
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new SnapshotError("Invalid snapshot collection");
  return value;
}
function unique(rows: { id: string }[]): void {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new SnapshotError("Duplicate snapshot identity");
}

export function validateSnapshot(value: unknown, now = Date.now(), checkDeliveryAge = true): PaperSnapshot {
  const root = object(value, ["protocol_version", "session_id", "run_id", "sequence", "captured_at", "account", "positions", "decisions", "coverage", "health"]);
  if (root.protocol_version !== 2) throw new SnapshotError("Unsupported paper snapshot protocol");
  const captured_at = timestamp(root.captured_at);
  if (checkDeliveryAge && (Date.parse(captured_at) > now + 5_000 || Date.parse(captured_at) < now - 120_000)) throw new SnapshotError("Snapshot delivery is stale or future dated");
  const rawAccount = object(root.account, ["initial_cash_cents", "cash_cents", "reserved_cash_cents", "equity_cents", "realized_pnl_cents", "unrealized_pnl_cents", "exposure_cents", "peak_equity_cents", "drawdown_cents"]);
  const account = {
    initial_cash_cents: integer(rawAccount.initial_cash_cents, 1), cash_cents: integer(rawAccount.cash_cents),
    reserved_cash_cents: integer(rawAccount.reserved_cash_cents), equity_cents: integer(rawAccount.equity_cents),
    realized_pnl_cents: integer(rawAccount.realized_pnl_cents, -MAX_CENTS), unrealized_pnl_cents: integer(rawAccount.unrealized_pnl_cents, -MAX_CENTS),
    exposure_cents: integer(rawAccount.exposure_cents), peak_equity_cents: integer(rawAccount.peak_equity_cents), drawdown_cents: integer(rawAccount.drawdown_cents),
  };
  const positions = array(root.positions, 100).map((value): PaperPosition => {
    const p = object(value, ["id", "instrument_id", "asset_class", "symbol", "quantity", "entry_price", "mark_price", "market_value_cents", "cost_basis_cents", "unrealized_pnl_cents", "updated_at"]);
    return { id: id(p.id), instrument_id: string(p.instrument_id, 180), asset_class: choice(p.asset_class, assets) as PaperPosition["asset_class"], symbol: string(p.symbol, 24), quantity: decimal(p.quantity), entry_price: decimal(p.entry_price), mark_price: decimal(p.mark_price, true), market_value_cents: integer(p.market_value_cents), cost_basis_cents: integer(p.cost_basis_cents), unrealized_pnl_cents: integer(p.unrealized_pnl_cents, -MAX_CENTS), updated_at: timestamp(p.updated_at) };
  });
  const decisions = array(root.decisions, 100).map((value): PaperDecision => {
    const d = object(value, ["id", "symbol", "action", "outcome", "message", "occurred_at", "allocation_bps"]);
    return { id: id(d.id), symbol: d.symbol === null ? null : string(d.symbol, 24), action: string(d.action, 40), outcome: string(d.outcome, 80), message: string(d.message, 2000), occurred_at: timestamp(d.occurred_at), allocation_bps: d.allocation_bps === null ? null : integer(d.allocation_bps, 0, 10_000) };
  });
  unique(positions); unique(decisions);
  if (account.reserved_cash_cents > account.cash_cents || account.cash_cents + account.exposure_cents !== account.equity_cents || account.initial_cash_cents + account.realized_pnl_cents + account.unrealized_pnl_cents !== account.equity_cents || account.peak_equity_cents < Math.max(account.initial_cash_cents, account.equity_cents) || account.drawdown_cents !== account.peak_equity_cents - account.equity_cents || positions.reduce((n, p) => n + p.market_value_cents, 0) !== account.exposure_cents || positions.reduce((n, p) => n + p.unrealized_pnl_cents, 0) !== account.unrealized_pnl_cents || positions.some((p) => p.market_value_cents - p.cost_basis_cents !== p.unrealized_pnl_cents || Date.parse(p.updated_at) > Date.parse(captured_at))) throw new SnapshotError("Paper account and positions do not reconcile");
  const c = object(root.coverage, ["status", "asset_classes", "scanned", "candidates", "truncated", "as_of", "detail"]);
  const coverage: PaperSnapshot["coverage"] = { status: choice(c.status, ["NOT_STARTED", "PARTIAL", "COMPLETE", "FAILED"]), asset_classes: array(c.asset_classes, 5).map((a) => choice(a, [...assets, "index"])), scanned: integer(c.scanned, 0, 10_000_000), candidates: integer(c.candidates, 0, 10_000_000), truncated: boolean(c.truncated), as_of: c.as_of === null ? null : timestamp(c.as_of), detail: string(c.detail, 2000) };
  if (coverage.candidates > coverage.scanned || (coverage.status === "COMPLETE" && coverage.truncated) || (coverage.as_of !== null && Date.parse(coverage.as_of) > Date.parse(captured_at))) throw new SnapshotError("Inconsistent market coverage");
  const h = object(root.health, ["status", "execution_paused", "research_paused", "kill_switch", "detail", "source_at"]);
  const health: PaperSnapshot["health"] = { status: choice(h.status, ["PAUSED", "RESEARCHING", "SIMULATING", "NO_TRADE", "DATA_STALE", "DISCONNECTED", "RECOVERY_REQUIRED"]), execution_paused: boolean(h.execution_paused), research_paused: boolean(h.research_paused), kill_switch: boolean(h.kill_switch), detail: string(h.detail, 2000), source_at: h.source_at === null ? null : timestamp(h.source_at) };
  if ((health.kill_switch && !health.execution_paused) || (health.source_at !== null && Date.parse(health.source_at) > Date.parse(captured_at))) throw new SnapshotError("Inconsistent health state");
  return { protocol_version: 2, session_id: id(root.session_id), run_id: id(root.run_id), sequence: integer(root.sequence, 1, 2_147_483_647), captured_at, account, positions, decisions, coverage, health };
}

export function validateInitialSnapshot(snapshot: PaperSnapshot): void {
  const a = snapshot.account;
  if (snapshot.sequence !== 1 || snapshot.positions.length || snapshot.decisions.length || a.cash_cents !== a.initial_cash_cents || a.equity_cents !== a.initial_cash_cents || a.reserved_cash_cents || a.realized_pnl_cents || a.unrealized_pnl_cents || a.exposure_cents || a.drawdown_cents || !snapshot.health.execution_paused || !snapshot.health.research_paused || snapshot.health.status !== "PAUSED" || snapshot.coverage.status !== "NOT_STARTED") throw new SnapshotError("A new session must start empty and paused");
}

export async function snapshotHash(snapshot: PaperSnapshot): Promise<string> {
  // validateSnapshot constructs a stable field order and strips no fields silently.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(snapshot)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

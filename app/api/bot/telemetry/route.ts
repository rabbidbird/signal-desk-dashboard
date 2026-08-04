import { getD1 } from "@/db";
import {
  asBoolean,
  asInteger,
  asIsoTimestamp,
  asMode,
  asString,
  readJsonObject,
  RequestError,
  requireBot,
  routeError,
} from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireBot(request);
    const body = await readJsonObject(request);
    const statements: D1PreparedStatement[] = [];
    const executionIndexes: number[] = [];
    const d1 = getD1();

    if (body.account !== undefined) statements.push(accountStatement(d1, object(body.account, "account")));
    if (body.risk !== undefined) statements.push(riskStatement(d1, object(body.risk, "risk")));
    if (body.positions !== undefined) statements.push(...positionStatements(d1, object(body.positions, "positions")));
    if (body.activities !== undefined) statements.push(...activityStatements(d1, array(body.activities, "activities", 100)));
    if (body.executions !== undefined) {
      for (const execution of array(body.executions, "executions", 50)) {
        executionIndexes.push(statements.length);
        statements.push(executionStatement(d1, object(execution, "execution")));
      }
    }
    if (!statements.length) throw new RequestError("At least one telemetry section is required");

    const results = await d1.batch(statements);
    const rejectedExecutionIndexes = executionIndexes
      .filter((index) => (results[index].meta.changes ?? 0) !== 1)
      .map((index) => executionIndexes.indexOf(index));
    return Response.json({ accepted: true, rejectedExecutionIndexes });
  } catch (error) {
    return routeError(error);
  }
}

function accountStatement(d1: D1Database, value: Record<string, unknown>) {
  return d1
    .prepare(
      `INSERT INTO account_snapshots
        (mode, account_label, equity_cents, buying_power_cents, open_exposure_cents, day_pnl_cents, win_rate_bps, open_positions_count, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      asMode(value.mode),
      asString(value.accountLabel, "account.accountLabel", { max: 80 }),
      asInteger(value.equityCents, "account.equityCents", { min: 0 }),
      asInteger(value.buyingPowerCents, "account.buyingPowerCents", { min: 0 }),
      asInteger(value.openExposureCents, "account.openExposureCents", { min: 0 }),
      asInteger(value.dayPnlCents, "account.dayPnlCents"),
      asInteger(value.winRateBps, "account.winRateBps", { min: 0, max: 10_000 }),
      asInteger(value.openPositionsCount, "account.openPositionsCount", { min: 0, max: 1_000 }),
      asIsoTimestamp(value.recordedAt, "account.recordedAt", { maxPastMs: 24 * 60 * 60_000, maxFutureMs: 30_000 }),
    );
}

function riskStatement(d1: D1Database, value: Record<string, unknown>) {
  return d1
    .prepare(
      `INSERT INTO risk_snapshots
        (mode, max_positions, max_exposure_cents, daily_loss_limit_cents, daily_loss_remaining_cents, stale_data, broker_connected, summary, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      asMode(value.mode),
      asInteger(value.maxPositions, "risk.maxPositions", { min: 0, max: 1_000 }),
      asInteger(value.maxExposureCents, "risk.maxExposureCents", { min: 0 }),
      asInteger(value.dailyLossLimitCents, "risk.dailyLossLimitCents", { min: 0 }),
      asInteger(value.dailyLossRemainingCents, "risk.dailyLossRemainingCents", { min: 0 }),
      asBoolean(value.staleData, "risk.staleData") ? 1 : 0,
      asBoolean(value.brokerConnected, "risk.brokerConnected") ? 1 : 0,
      asString(value.summary, "risk.summary", { max: 500 }),
      asIsoTimestamp(value.recordedAt, "risk.recordedAt", { maxPastMs: 24 * 60 * 60_000, maxFutureMs: 30_000 }),
    );
}

function positionStatements(d1: D1Database, value: Record<string, unknown>) {
  const mode = asMode(value.mode, "positions.mode");
  const items = array(value.items, "positions.items", 100);
  const statements = [
    d1.prepare("UPDATE positions SET status = 'closed' WHERE mode = ? AND status = 'open'").bind(mode),
  ];
  for (const [index, raw] of items.entries()) {
    const item = object(raw, `positions.items[${index}]`);
    const id = safeId(item.id, `positions.items[${index}].id`);
    const status = asString(item.status, `positions.items[${index}].status`, { max: 6 });
    if (status !== "open" && status !== "closed") throw new RequestError("position status must be open or closed");
    const optionType = asString(item.optionType, `positions.items[${index}].optionType`, { max: 4 });
    if (optionType !== "call" && optionType !== "put") throw new RequestError("position optionType must be call or put");
    statements.push(
      d1
        .prepare(
          `INSERT INTO positions
            (id, mode, symbol, strategy, instrument_id, option_type, expiration, strike_cents, quantity, entry_price_cents, mark_price_cents, pnl_cents, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             mode=excluded.mode, symbol=excluded.symbol, strategy=excluded.strategy,
             instrument_id=excluded.instrument_id, option_type=excluded.option_type,
             expiration=excluded.expiration, strike_cents=excluded.strike_cents,
             quantity=excluded.quantity, entry_price_cents=excluded.entry_price_cents,
             mark_price_cents=excluded.mark_price_cents, pnl_cents=excluded.pnl_cents,
             status=excluded.status, updated_at=excluded.updated_at`,
        )
        .bind(
          id,
          mode,
          asString(item.symbol, "position.symbol", { max: 12 })?.toUpperCase(),
          asString(item.strategy, "position.strategy", { max: 40 }),
          asString(item.instrumentId, "position.instrumentId", { max: 180 }),
          optionType,
          isoDate(item.expiration, "position.expiration"),
          asInteger(item.strikeCents, "position.strikeCents", { min: 1 }),
          asInteger(item.quantity, "position.quantity", { min: 1, max: 1_000 }),
          asInteger(item.entryPriceCents, "position.entryPriceCents", { min: 0 }),
          asInteger(item.markPriceCents, "position.markPriceCents", { min: 0 }),
          asInteger(item.pnlCents, "position.pnlCents"),
          status,
          asIsoTimestamp(item.updatedAt, "position.updatedAt", { maxPastMs: 24 * 60 * 60_000, maxFutureMs: 30_000 }),
        ),
    );
  }
  return statements;
}

function activityStatements(d1: D1Database, values: unknown[]) {
  return values.map((raw, index) => {
    const value = object(raw, `activities[${index}]`);
    return d1
      .prepare(
        `INSERT OR IGNORE INTO activity_events
          (id, mode, proposal_id, event_type, symbol, message, amount_cents, status, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        safeId(value.id, `activities[${index}].id`),
        asMode(value.mode, `activities[${index}].mode`),
        asString(value.proposalId, "activity.proposalId", { optional: true, max: 100 }),
        asString(value.eventType, "activity.eventType", { max: 60 }),
        asString(value.symbol, "activity.symbol", { optional: true, max: 12 })?.toUpperCase() ?? null,
        asString(value.message, "activity.message", { max: 500 }),
        asInteger(value.amountCents, "activity.amountCents", { optional: true }),
        asString(value.status, "activity.status", { max: 40 }),
        asIsoTimestamp(value.occurredAt, "activity.occurredAt", { maxPastMs: 7 * 24 * 60 * 60_000, maxFutureMs: 30_000 }),
      );
  });
}

function executionStatement(d1: D1Database, value: Record<string, unknown>) {
  const status = asString(value.status, "execution.status", { max: 30 });
  if (!["submitted", "partially_filled", "filled", "cancelled", "rejected"].includes(status as string)) {
    throw new RequestError("Unsupported execution status");
  }
  const materialHash = asString(value.materialHash, "execution.materialHash", { max: 64 }) as string;
  if (!/^[a-f0-9]{64}$/.test(materialHash)) throw new RequestError("Invalid execution material hash");
  return d1
    .prepare(
      `UPDATE proposals
       SET status = ?, broker_order_id = COALESCE(?, broker_order_id), updated_at = ?
       WHERE id = ? AND material_hash = ?
         AND status IN ('approved', 'submitted', 'partially_filled')
         AND EXISTS (
           SELECT 1 FROM decisions
           WHERE decisions.id = ? AND decisions.proposal_id = proposals.id
             AND decisions.material_hash = proposals.material_hash
             AND decisions.proposal_revision = proposals.revision
             AND decisions.decision = 'approved'
         )`,
    )
    .bind(
      status,
      asString(value.brokerOrderId, "execution.brokerOrderId", { optional: true, max: 180 }),
      asIsoTimestamp(value.occurredAt, "execution.occurredAt", { maxPastMs: 24 * 60 * 60_000, maxFutureMs: 30_000 }),
      safeId(value.proposalId, "execution.proposalId"),
      materialHash,
      safeId(value.decisionId, "execution.decisionId"),
    );
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new RequestError(`${field} must be an array with at most ${max} entries`);
  return value;
}

function safeId(value: unknown, field: string): string {
  const id = asString(value, field, { max: 100 }) as string;
  if (!/^[A-Za-z0-9:_-]+$/.test(id)) throw new RequestError(`${field} contains unsupported characters`);
  return id;
}

function isoDate(value: unknown, field: string): string {
  const raw = asString(value, field, { max: 10 }) as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new RequestError(`${field} must use YYYY-MM-DD`);
  }
  return raw;
}

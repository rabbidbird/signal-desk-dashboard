import { getD1 } from "@/db";
import { asString, readJsonObject, RequestError, requireBrowserWrite, routeError } from "@/app/lib/server";

export const dynamic = "force-dynamic";

type ControlAction = "pause" | "resume" | "engage_kill" | "clear_kill";

export async function PATCH(request: Request) {
  try {
    const user = await requireBrowserWrite(request);
    const body = await readJsonObject(request);
    const action = asString(body.action, "action", { max: 20 }) as ControlAction;
    if (!["pause", "resume", "engage_kill", "clear_kill"].includes(action)) {
      throw new RequestError("Unknown control action");
    }
    const suppliedReason = asString(body.reason, "reason", { optional: true, max: 300 });
    if ((action === "engage_kill" || action === "clear_kill") && !suppliedReason) {
      throw new RequestError("A reason is required for kill-switch changes");
    }
    const now = new Date().toISOString();
    const reason = suppliedReason ?? defaultReason(action);
    const d1 = getD1();
    let statement: D1PreparedStatement;

    if (action === "pause" || action === "engage_kill") {
      const kill = action === "engage_kill" ? 1 : 0;
      statement = d1
        .prepare(
          `INSERT INTO system_state
            (id, paused, kill_switch_engaged, reason, version, updated_by, updated_at)
           VALUES (1, 1, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             paused = 1,
             kill_switch_engaged = CASE WHEN ? = 1 THEN 1 ELSE system_state.kill_switch_engaged END,
             reason = excluded.reason,
             version = system_state.version + 1,
             updated_by = excluded.updated_by,
             updated_at = excluded.updated_at`,
        )
        .bind(kill, reason, user.userId, now, kill);
    } else if (action === "clear_kill") {
      statement = d1
        .prepare(
          `UPDATE system_state
           SET kill_switch_engaged = 0, paused = 1, reason = ?, version = version + 1, updated_by = ?, updated_at = ?
           WHERE id = 1 AND kill_switch_engaged = 1`,
        )
        .bind(reason, user.userId, now);
    } else {
      statement = d1
        .prepare(
          `UPDATE system_state
           SET paused = 0, reason = ?, version = version + 1, updated_by = ?, updated_at = ?
           WHERE id = 1 AND kill_switch_engaged = 0
             AND NOT EXISTS (SELECT 1 FROM paper_session_pointer WHERE id=1 AND execution_armed=0)`,
        )
        .bind(reason, user.userId, now);
    }

    const stateResult = await statement.run();
    if ((stateResult.meta.changes ?? 0) !== 1) {
      throw new RequestError(
        action === "resume"
          ? "Resuming requires a cleared kill switch and an activated paper session"
          : "The requested control state was already clear",
        409,
      );
    }
    await d1
      .prepare(
        `INSERT INTO activity_events
          (id, mode, proposal_id, event_type, symbol, message, amount_cents, status, occurred_at)
         VALUES (?, 'paper', NULL, 'system_control', NULL, ?, NULL, ?, ?)`,
      )
      .bind(crypto.randomUUID(), reason, action, now)
      .run();
    const state = await d1.prepare("SELECT * FROM system_state WHERE id = 1").first();
    return Response.json({ system: state });
  } catch (error) {
    return routeError(error);
  }
}

function defaultReason(action: ControlAction): string {
  if (action === "pause") return "New trades paused by operator";
  if (action === "resume") return "Operator resumed eligible trading";
  return "Operator updated emergency controls";
}

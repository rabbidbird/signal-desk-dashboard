import { getD1 } from "@/db";
import {
  asInteger,
  asString,
  readJsonObject,
  RequestError,
  requireBrowserWrite,
  routeError,
  type ProposalDecision,
} from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireBrowserWrite(request);
    const { id } = await context.params;
    if (!/^[A-Za-z0-9:_-]{1,100}$/.test(id)) throw new RequestError("Invalid proposal id");
    const body = await readJsonObject(request);
    const decision = asString(body.decision, "decision", { max: 8 }) as ProposalDecision;
    if (decision !== "approved" && decision !== "denied") {
      throw new RequestError("decision must be approved or denied");
    }
    const revision = asInteger(body.revision, "revision", { min: 1 }) as number;
    const materialHash = asString(body.materialHash, "materialHash", { max: 64 }) as string;
    if (!/^[a-f0-9]{64}$/.test(materialHash)) throw new RequestError("Invalid proposal material hash");
    const reason = asString(body.reason, "reason", { optional: true, max: 500 });
    const now = new Date().toISOString();
    const decisionId = crypto.randomUUID();
    const activityId = crypto.randomUUID();
    const d1 = getD1();

    const results = await d1.batch([
      d1
        .prepare(
          `INSERT INTO decisions
            (id, proposal_id, proposal_revision, material_hash, decision, reason, actor_user_id, actor_email, decided_at)
           SELECT ?, id, revision, material_hash, ?, ?, ?, ?, ?
           FROM proposals
           WHERE id = ? AND revision = ? AND material_hash = ?
             AND status = 'pending' AND expires_at > ?
             AND NOT EXISTS (SELECT 1 FROM paper_session_pointer WHERE id=1)
             AND (
               ? = 'denied' OR EXISTS (
                 SELECT 1 FROM system_state
                 WHERE id = 1 AND paused = 0 AND kill_switch_engaged = 0
               )
             )`,
        )
        .bind(
          decisionId,
          decision,
          reason,
          user.userId,
          user.email,
          now,
          id,
          revision,
          materialHash,
          now,
          decision,
        ),
      d1
        .prepare(
          `UPDATE proposals
           SET status = ?, updated_at = ?
           WHERE id = ? AND revision = ? AND material_hash = ? AND status = 'pending'
             AND EXISTS (
               SELECT 1 FROM decisions
               WHERE decisions.proposal_id = proposals.id AND decisions.id = ?
             )`,
        )
        .bind(decision, now, id, revision, materialHash, decisionId),
      d1
        .prepare(
          `INSERT INTO activity_events
            (id, mode, proposal_id, event_type, symbol, message, amount_cents, status, occurred_at)
           SELECT ?, mode, id, 'operator_decision', symbol, ?, NULL, ?, ?
           FROM proposals
           WHERE id = ? AND EXISTS (
             SELECT 1 FROM decisions WHERE decisions.id = ?
           )`,
        )
        .bind(activityId, reason || `Proposal ${decision}`, decision, now, id, decisionId),
    ]);

    if ((results[0].meta.changes ?? 0) !== 1) {
      throw new RequestError(
        decision === "approved"
          ? "Approval failed: the proposal expired, changed, was already decided, or trading is paused"
          : "Denial failed: the proposal expired, changed, or was already decided",
        409,
      );
    }
    return Response.json({ decision: { id: decisionId, proposalId: id, revision, materialHash, decision, decidedAt: now } });
  } catch (error) {
    return routeError(error);
  }
}

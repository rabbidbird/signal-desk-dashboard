import { and, eq } from "drizzle-orm";
import { getD1, getDb } from "@/db";
import { activityEvents, proposals } from "@/db/schema";
import {
  isPaperAutoApprovalEnabled,
  normalizeProposalInput,
  proposalMaterialHash,
  readJsonObject,
  RequestError,
  requireBot,
  routeError,
} from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireBot(request);
    const input = normalizeProposalInput(await readJsonObject(request));
    const materialHash = await proposalMaterialHash(input);
    const db = getDb();
    const now = new Date().toISOString();
    const [existing] = await db.select().from(proposals).where(eq(proposals.id, input.id)).limit(1);

    if (existing?.materialHash === materialHash) {
      const proposal = await maybeAutoApprove(existing, now);
      return Response.json({
        accepted: true,
        proposalId: proposal.id,
        materialHash: proposal.materialHash,
        proposal,
        idempotent: true,
        autoApproved: proposal.status === "approved",
      });
    }
    if (existing && existing.status !== "pending") {
      throw new RequestError("A decided or submitted proposal is immutable; create a new proposal id", 409);
    }

    let stored;
    let eventType: "proposal_created" | "proposal_revised";
    if (existing) {
      const [updated] = await db
        .update(proposals)
        .set({
          ...input,
          materialHash,
          revision: existing.revision + 1,
          status: "pending",
          updatedAt: now,
        })
        .where(and(eq(proposals.id, input.id), eq(proposals.status, "pending"), eq(proposals.revision, existing.revision)))
        .returning();
      if (!updated) throw new RequestError("Proposal changed while it was being revised; retry with current state", 409);
      stored = updated;
      eventType = "proposal_revised";
    } else {
      const [created] = await db
        .insert(proposals)
        .values({ ...input, materialHash, revision: 1, status: "pending", createdAt: now, updatedAt: now })
        .returning();
      stored = created;
      eventType = "proposal_created";
    }

    await db.insert(activityEvents).values({
      id: crypto.randomUUID(),
      mode: input.mode,
      proposalId: input.id,
      eventType,
      symbol: input.symbol,
      message: eventType === "proposal_created" ? "Trade proposal awaiting operator decision" : "Material change created a new proposal revision",
      status: "pending",
      occurredAt: now,
    });
    const proposal = await maybeAutoApprove(stored, now);
    return Response.json(
      {
        accepted: true,
        proposalId: proposal.id,
        materialHash: proposal.materialHash,
        proposal,
        idempotent: false,
        autoApproved: proposal.status === "approved",
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}

async function maybeAutoApprove(
  proposal: typeof proposals.$inferSelect,
  now: string,
): Promise<typeof proposals.$inferSelect> {
  if (!isPaperAutoApprovalEnabled() || proposal.mode !== "paper" || proposal.status !== "pending") {
    return proposal;
  }

  const decisionId = `paper-auto:${proposal.id}:r${proposal.revision}`;
  const activityId = `paper-auto-activity:${proposal.id}:r${proposal.revision}`;
  const reason = "Paper proposal auto-approved by operator-enabled policy";
  const d1 = getD1();
  await d1.batch([
    d1
      .prepare(
        `INSERT OR IGNORE INTO decisions
          (id, proposal_id, proposal_revision, material_hash, decision, reason, actor_user_id, actor_email, decided_at)
         SELECT ?, p.id, p.revision, p.material_hash, 'approved', ?, 'paper-auto-policy',
                'paper-auto@signal-desk.local', ?
         FROM proposals AS p
         INNER JOIN system_state AS s ON s.id = 1
         WHERE p.id = ? AND p.mode = 'paper' AND p.status = 'pending'
           AND p.expires_at > ? AND s.paused = 0 AND s.kill_switch_engaged = 0`,
      )
      .bind(decisionId, reason, now, proposal.id, now),
    d1
      .prepare(
        `UPDATE proposals
         SET status = 'approved', updated_at = ?
         WHERE id = ? AND mode = 'paper' AND status = 'pending'
           AND EXISTS (
             SELECT 1 FROM decisions
             WHERE decisions.id = ? AND decisions.proposal_id = proposals.id
               AND decisions.proposal_revision = proposals.revision
               AND decisions.material_hash = proposals.material_hash
               AND decisions.decision = 'approved'
           )`,
      )
      .bind(now, proposal.id, decisionId),
    d1
      .prepare(
        `INSERT OR IGNORE INTO activity_events
          (id, mode, proposal_id, event_type, symbol, message, amount_cents, status, occurred_at)
         SELECT ?, 'paper', p.id, 'proposal_auto_approved', p.symbol, ?, NULL, 'approved', ?
         FROM proposals AS p
         INNER JOIN decisions AS d ON d.proposal_id = p.id
         WHERE p.id = ? AND p.status = 'approved' AND d.id = ?`,
      )
      .bind(activityId, reason, now, proposal.id, decisionId),
  ]);

  const db = getDb();
  const [updated] = await db.select().from(proposals).where(eq(proposals.id, proposal.id)).limit(1);
  return updated ?? proposal;
}

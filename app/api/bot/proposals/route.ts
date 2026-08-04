import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activityEvents, proposals } from "@/db/schema";
import {
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
      return Response.json({ proposal: existing, idempotent: true });
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
    return Response.json({ proposal: stored, idempotent: false }, { status: existing ? 200 : 201 });
  } catch (error) {
    return routeError(error);
  }
}

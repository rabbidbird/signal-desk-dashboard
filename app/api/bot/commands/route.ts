import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { decisions, proposals, systemState } from "@/db/schema";
import { RequestError, requireBot, routeError } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireBot(request);
    const url = new URL(request.url);
    const rawSince = url.searchParams.get("since");
    const sinceMs = rawSince ? Date.parse(rawSince) : Date.now() - 24 * 60 * 60_000;
    if (!Number.isFinite(sinceMs)) throw new RequestError("since must be an ISO timestamp");
    if (sinceMs < Date.now() - 7 * 24 * 60 * 60_000) throw new RequestError("since cannot be older than seven days");
    const since = new Date(sinceMs).toISOString();
    const db = getDb();
    const [stateRows, commandRows] = await Promise.all([
      db.select().from(systemState).where(eq(systemState.id, 1)).limit(1),
      db
        .select({ decision: decisions, proposal: proposals })
        .from(decisions)
        .innerJoin(
          proposals,
          and(
            eq(proposals.id, decisions.proposalId),
            eq(proposals.revision, decisions.proposalRevision),
            eq(proposals.materialHash, decisions.materialHash),
          ),
        )
        .where(gt(decisions.decidedAt, since))
        .orderBy(desc(decisions.decidedAt))
        .limit(100),
    ]);
    const now = new Date().toISOString();
    return Response.json(
      {
        serverTime: now,
        system: stateRows[0] ?? {
          id: 1,
          paused: true,
          killSwitchEngaged: false,
          reason: "Awaiting initial operator review",
          version: 0,
          updatedAt: now,
        },
        commands: commandRows,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

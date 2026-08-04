import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { firstRowPerMode } from "@/app/lib/first-row-per-mode";
import { isPaperAutoApprovalEnabled } from "@/app/lib/server";
import {
  accountSnapshots,
  activityEvents,
  positions,
  proposals,
  riskSnapshots,
  systemState,
  watchlistStatus,
} from "@/db/schema";

export async function getDashboardData() {
  const db = getDb();
  const now = new Date().toISOString();
  const [pending, accounts, risk, openPositions, activity, stateRows, watchlistRows] = await Promise.all([
    db
      .select()
      .from(proposals)
      .where(and(eq(proposals.status, "pending"), gt(proposals.expiresAt, now)))
      .orderBy(proposals.expiresAt)
      .limit(20),
    db.select().from(accountSnapshots).orderBy(desc(accountSnapshots.recordedAt)).limit(60),
    db.select().from(riskSnapshots).orderBy(desc(riskSnapshots.recordedAt)).limit(20),
    db.select().from(positions).where(eq(positions.status, "open")).orderBy(desc(positions.updatedAt)).limit(100),
    db.select().from(activityEvents).orderBy(desc(activityEvents.occurredAt)).limit(50),
    db.select().from(systemState).where(eq(systemState.id, 1)).limit(1),
    db.select().from(watchlistStatus).where(eq(watchlistStatus.id, 1)).limit(1),
  ]);

  const latestAccounts = firstRowPerMode(accounts);
  const latestRisk = firstRowPerMode(risk);
  return {
    serverTime: now,
    paperAutoApprove: isPaperAutoApprovalEnabled(),
    proposals: pending.map((proposal) => ({
      ...proposal,
      brokerAlerts: safeStringArray(proposal.brokerAlertsJson),
      brokerAlertsJson: undefined,
      materialHash: proposal.materialHash,
    })),
    accounts: latestAccounts,
    equityHistory: accounts.slice().reverse(),
    risk: latestRisk,
    positions: openPositions,
    activity,
    watchlist: watchlistRows[0] ?? null,
    system: stateRows[0] ?? {
      id: 1,
      paused: true,
      killSwitchEngaged: false,
      reason: "Awaiting initial operator review",
      version: 0,
      updatedBy: "system",
      updatedAt: now,
    },
  };
}

function safeStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

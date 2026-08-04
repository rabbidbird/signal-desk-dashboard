import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountSnapshots,
  activityEvents,
  positions,
  proposals,
  riskSnapshots,
  systemState,
} from "@/db/schema";

export async function getDashboardData() {
  const db = getDb();
  const now = new Date().toISOString();
  const [pending, accounts, risk, openPositions, activity, stateRows] = await Promise.all([
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
  ]);

  const latestAccounts = [...new Map(accounts.map((row) => [row.mode, row])).values()];
  const latestRisk = [...new Map(risk.map((row) => [row.mode, row])).values()];
  return {
    serverTime: now,
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

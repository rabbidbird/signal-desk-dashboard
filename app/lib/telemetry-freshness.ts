// Account reporting follows the 15-minute heartbeat, with five minutes to finish.
export const TELEMETRY_MAX_AGE_MS = 20 * 60_000;

export function telemetryFreshness(recordedAt: string | undefined, nowMs: number) {
  if (!recordedAt) return { current: false, label: "Awaiting sync", detail: "No snapshot received" };
  const recorded = Date.parse(recordedAt);
  if (!Number.isFinite(recorded) || !Number.isFinite(nowMs) || recorded > nowMs) {
    return { current: false, label: "Stale", detail: "Invalid snapshot timestamp" };
  }
  const current = nowMs - recorded <= TELEMETRY_MAX_AGE_MS;
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(recorded));
  return { current, label: current ? "Current" : "Stale", detail: `Snapshot ${date}` };
}

type AccountSnapshot = { recordedAt: string; openPositionsCount: number };
type RiskSnapshot = { recordedAt: string; staleData: boolean };
type PositionSnapshot = { updatedAt: string };

export function financialTelemetry(
  account: AccountSnapshot | undefined,
  risk: RiskSnapshot | undefined,
  positions: PositionSnapshot[],
  nowMs: number,
) {
  const accountFreshness = telemetryFreshness(account?.recordedAt, nowMs);
  const riskFreshness = telemetryFreshness(risk?.recordedAt, nowMs);
  const positionsAgree = !!account && account.openPositionsCount === positions.length;
  const snapshotsAgree = !!account && !!risk && Date.parse(account.recordedAt) === Date.parse(risk.recordedAt)
    && positions.every((position) => Date.parse(position.updatedAt) === Date.parse(account.recordedAt));
  const marketDataCurrent = riskFreshness.current && risk?.staleData === false;
  const positionsCurrent = accountFreshness.current && positionsAgree && snapshotsAgree && marketDataCurrent
    && positions.every((position) => telemetryFreshness(position.updatedAt, nowMs).current);
  const accountCurrent = accountFreshness.current && positionsCurrent;
  return {
    accountFreshness, riskFreshness, accountCurrent, marketDataCurrent, positionsCurrent,
    needsAttention: !accountCurrent || !marketDataCurrent,
    detail: !accountFreshness.current ? `Account: ${accountFreshness.detail}.`
      : !riskFreshness.current ? `Risk: ${riskFreshness.detail}.`
      : risk?.staleData ? "Position prices or market data need a fresh update."
      : !positionsAgree || !snapshotsAgree ? "Account, risk, and position snapshots disagree; awaiting a complete update."
      : !positionsCurrent ? "Position snapshots need a fresh update."
      : accountFreshness.detail,
  };
}

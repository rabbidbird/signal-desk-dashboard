const EASTERN_TIME_ZONE = "America/New_York";
const HEARTBEAT_INTERVAL_MS = 15 * 60_000;
const COMPLETION_GRACE_MS = 5 * 60_000;
const CLOSED_SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60_000;

export type WatchlistFreshness = {
  label: "Fresh" | "Aging" | "Stale" | "Market closed";
  detail: string;
};

function easternSessionClock(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const weekday = part("weekday");
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));
  const weekdayOpen = weekday !== "Sat" && weekday !== "Sun";
  const minuteOfDay = hour * 60 + minute;
  return {
    regularSessionOpen:
      weekdayOpen && minuteOfDay >= 9 * 60 + 30 && minuteOfDay < 16 * 60,
  };
}

function ageDetail(ageMinutes: number) {
  return ageMinutes < 60
    ? `${ageMinutes}m old`
    : `${Math.floor(ageMinutes / 60)}h old`;
}

export function watchlistFreshness(
  syncedAt: string,
  serverTime: string,
): WatchlistFreshness {
  const synced = Date.parse(syncedAt);
  const server = Date.parse(serverTime);
  if (!Number.isFinite(synced) || !Number.isFinite(server)) {
    return { label: "Stale", detail: "invalid timestamp" };
  }
  const ageMs = Math.max(0, server - synced);
  const ageMinutes = Math.floor(ageMs / 60_000);
  const session = easternSessionClock(new Date(server));

  if (!session.regularSessionOpen && ageMs <= CLOSED_SESSION_MAX_AGE_MS) {
    return {
      label: "Market closed",
      detail: `${ageDetail(ageMinutes)} since last session sync`,
    };
  }
  if (ageMs <= 2 * 60_000) {
    return { label: "Fresh", detail: "under 2m old" };
  }
  if (ageMs <= HEARTBEAT_INTERVAL_MS + COMPLETION_GRACE_MS) {
    return { label: "Aging", detail: ageDetail(ageMinutes) };
  }
  return { label: "Stale", detail: ageDetail(ageMinutes) };
}

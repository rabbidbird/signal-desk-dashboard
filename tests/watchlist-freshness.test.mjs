import assert from "node:assert/strict";
import test from "node:test";
import { watchlistFreshness } from "../app/lib/watchlist-freshness.ts";

test("labels the final regular-session snapshot as market closed after 16:00 ET", () => {
  assert.deepEqual(
    watchlistFreshness("2026-08-27T19:46:30Z", "2026-08-27T20:44:00Z"),
    { label: "Market closed", detail: "57m old since last session sync" },
  );
});

test("allows one cadence plus completion grace during the regular session", () => {
  assert.deepEqual(
    watchlistFreshness("2026-08-27T19:35:00Z", "2026-08-27T19:55:00Z"),
    { label: "Aging", detail: "20m old" },
  );
  assert.deepEqual(
    watchlistFreshness("2026-08-27T19:34:59Z", "2026-08-27T19:55:00Z"),
    { label: "Stale", detail: "20m old" },
  );
});

test("keeps a recent prior-session snapshot expected before the next open", () => {
  assert.equal(
    watchlistFreshness("2026-08-26T19:46:00Z", "2026-08-27T12:45:00Z").label,
    "Market closed",
  );
});

test("does not hide a genuinely obsolete snapshot outside session hours", () => {
  assert.equal(
    watchlistFreshness("2026-08-20T19:46:00Z", "2026-08-27T12:45:00Z").label,
    "Stale",
  );
});

test("fails closed on invalid timestamps", () => {
  assert.deepEqual(watchlistFreshness("invalid", "also-invalid"), {
    label: "Stale",
    detail: "invalid timestamp",
  });
});

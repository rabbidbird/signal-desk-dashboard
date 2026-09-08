import assert from "node:assert/strict";
import test from "node:test";
import { financialTelemetry, telemetryFreshness, TELEMETRY_MAX_AGE_MS } from "../app/lib/telemetry-freshness.ts";

const now = Date.parse("2026-09-08T14:30:00Z");
const stamp = new Date(now).toISOString();
const account = { recordedAt: stamp, openPositionsCount: 0 };
const risk = { recordedAt: stamp, staleData: false };

test("an August snapshot remains stale after a successful September page refresh", () => {
  const old = "2026-08-04T16:50:50.901Z";
  const result = financialTelemetry({ ...account, recordedAt: old }, { ...risk, recordedAt: old }, [], now);
  assert.equal(result.accountCurrent, false);
  assert.equal(result.marketDataCurrent, false);
  assert.equal(result.needsAttention, true);
  assert.match(result.accountFreshness.detail, /Aug 4, 2026/);
});

test("cadence plus completion grace expires even when no further API response arrives", () => {
  assert.equal(financialTelemetry(account, risk, [], now + TELEMETRY_MAX_AGE_MS).accountCurrent, true);
  assert.equal(financialTelemetry(account, risk, [], now + TELEMETRY_MAX_AGE_MS + 1).accountCurrent, false);
});

test("missing, malformed and future timestamps never claim current telemetry", () => {
  for (const value of [undefined, "bad", "2026-09-09T14:30:00Z"]) {
    assert.equal(telemetryFreshness(value, now).current, false);
  }
  assert.equal(telemetryFreshness(stamp, NaN).current, false);
  assert.equal(financialTelemetry(undefined, undefined, [], now).positionsCurrent, false);
});

test("fresh timestamps do not override stale prices or mismatched positions", () => {
  assert.equal(financialTelemetry(account, { ...risk, staleData: true }, [], now).accountCurrent, false);
  const mismatch = financialTelemetry({ ...account, openPositionsCount: 1 }, risk, [], now);
  assert.equal(mismatch.accountCurrent, false);
  assert.match(mismatch.detail, /disagree/);
  const oldPosition = [{ updatedAt: "2026-08-04T16:50:50Z" }];
  assert.equal(financialTelemetry({ ...account, openPositionsCount: 1 }, risk, oldPosition, now).positionsCurrent, false);
});

test("complete fresh flat and occupied snapshots display current account data", () => {
  assert.equal(financialTelemetry(account, risk, [], now).accountCurrent, true);
  assert.equal(financialTelemetry({ ...account, openPositionsCount: 1 }, risk, [{ updatedAt: stamp }], now).positionsCurrent, true);
  assert.equal(financialTelemetry(account, { ...risk, recordedAt: "2026-08-04T16:50:50Z" }, [], now).accountCurrent, false);
});

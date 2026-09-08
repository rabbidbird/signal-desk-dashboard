import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { financialTelemetry } from "../app/lib/telemetry-freshness.ts";

// Render the actual panel code with deterministic data; no browser credentials or D1.
const source = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(`${source}\nexport { AccountSummary, PositionsPanel, RiskPanel };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const localRequire = createRequire(new URL("../app/dashboard-client.tsx", import.meta.url));
const exports = {};
runInNewContext(compiled, {
  exports,
  require: (id) => localRequire(id.startsWith("@/app/lib/") ? `./lib/${id.slice("@/app/lib/".length)}.ts` : id),
});
const now = Date.parse("2026-09-08T14:30:00Z");
const current = new Date(now).toISOString();
const old = "2026-08-04T16:50:50Z";
const account = { mode: "paper", accountLabel: "Paper ledger", equityCents: 10009000, buyingPowerCents: 9873000, openExposureCents: 127000, dayPnlCents: 9000, winRateBps: 0, openPositionsCount: 1, recordedAt: old };
const risk = { mode: "paper", maxPositions: 3, maxExposureCents: 1000000, dailyLossRemainingCents: 500000, staleData: false, brokerConnected: true, recordedAt: old };
const system = { paused: false, killSwitchEngaged: false, reason: "Eligible" };

test("stale financial panels hide today's totals and reject a false fresh badge", () => {
  const telemetry = financialTelemetry(account, risk, [], now);
  const summary = renderToStaticMarkup(React.createElement(exports.AccountSummary, { account: telemetry.accountCurrent ? account : undefined, mode: "paper" }));
  assert.doesNotMatch(summary, /100,090|98,730|1,270|\+\$90|Across 1/);
  assert.match(summary, /Awaiting current account data/);
  const controls = renderToStaticMarkup(React.createElement(exports.RiskPanel, { account, risk, system, telemetry, paperAutoApprove: true, controlReason: "" }));
  assert.doesNotMatch(controls, />Fresh</);
  assert.doesNotMatch(controls, />Reported connected</);
  assert.match(controls, /Aug 4, 2026/);
  assert.match(controls, /Pause new trades/);
  const positions = renderToStaticMarkup(React.createElement(exports.PositionsPanel, { positions: [], current: false, detail: telemetry.detail }));
  assert.match(positions, /Position status unavailable/);
  assert.doesNotMatch(positions, /No open positions/);
});

test("a fresh complete flat snapshot displays its real zero positions and equity", () => {
  const flat = { ...account, recordedAt: current, openPositionsCount: 0, openExposureCents: 0, dayPnlCents: 0 };
  const telemetry = financialTelemetry(flat, { ...risk, recordedAt: current }, [], now);
  const summary = renderToStaticMarkup(React.createElement(exports.AccountSummary, { account: telemetry.accountCurrent ? flat : undefined, mode: "paper" }));
  assert.match(summary, /100,090/);
  assert.match(summary, /Across 0 positions/);
  const positions = renderToStaticMarkup(React.createElement(exports.PositionsPanel, { positions: [], current: telemetry.positionsCurrent, detail: telemetry.detail }));
  assert.match(positions, /No open positions/);
  const controls = renderToStaticMarkup(React.createElement(exports.RiskPanel, { account: flat, risk: { ...risk, recordedAt: current, brokerConnected: false }, system, telemetry, paperAutoApprove: true, controlReason: "" }));
  assert.match(controls, /Not required/);
  assert.match(controls, /Not confirmed/);
});

test("a newly delivered stale-data warning cannot expose placeholder risk limits", () => {
  const flat = { ...account, recordedAt: current, openPositionsCount: 0 };
  const unavailable = { ...risk, recordedAt: current, staleData: true };
  const telemetry = financialTelemetry(flat, unavailable, [], now);
  const controls = renderToStaticMarkup(React.createElement(exports.RiskPanel, { account: flat, risk: unavailable, system, telemetry, paperAutoApprove: true, controlReason: "" }));
  assert.doesNotMatch(controls, /10,000|5,000/);
  assert.match(controls, /Stale/);
});

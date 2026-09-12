import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(new URL("../app/paper-session-client.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const require = createRequire(import.meta.url);
const exports = {};
runInNewContext(code, { exports, require: (id) => id === "@/app/dashboard-client" ? (() => null) : require(id), Intl, Date });

test("the actual session panels render $1000, full allocation, full market and honest paused state", () => {
  const snapshot = { account: { initial_cash_cents: 100000, cash_cents: 100000, reserved_cash_cents: 0, equity_cents: 100000, exposure_cents: 0, drawdown_cents: 0, peak_equity_cents: 100000, realized_pnl_cents: 0, unrealized_pnl_cents: 0 }, positions: [], decisions: [], sequence: 1, coverage: { status: "NOT_STARTED", detail: "No research performed.", scanned: 0, candidates: 0, asset_classes: [], truncated: false }, health: { status: "PAUSED", detail: "Awaiting activation", source_at: null } };
  const markup = renderToStaticMarkup(React.createElement(exports.SessionPanels, { snapshot, paused: true, researchPaused: true, armed: false }));
  assert.match(markup, /\$1,000\.00/); assert.match(markup, /0–100%/); assert.match(markup, /Full supported market/);
  assert.match(markup, /Paused/); assert.match(markup, /No open positions in this session/); assert.match(markup, /No decisions or fills yet/);
  assert.doesNotMatch(markup, /AAPL|100,000\.00|Broker connected|>COMPLETE</);
});

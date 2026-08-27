import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { firstRowPerMode } from "../app/lib/first-row-per-mode.ts";

const root = new URL("../", import.meta.url);

test("protects the dashboard with ChatGPT sign-in", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /requireChatGPTUser\("\/"\)/);
  assert.match(page, /force-dynamic/);
});

test("builds the authenticated operations dashboard", async () => {
  await access(new URL("dist/server/index.js", root));
  const client = await readFile(new URL("app/dashboard-client.tsx", root), "utf8");
  assert.match(client, /Pending approvals/);
  assert.match(client, /Risk &amp; emergency controls/);
  assert.match(client, /ChatGPT verified/);
  assert.match(client, /research only/);
  assert.doesNotMatch(client, /Preview data|illustrative|Bull call spread/);
});

test("declares durable storage and protected bot API configuration", async () => {
  const [hosting, environment, schema, decisionRoute] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/proposals/[id]/decision/route.ts", root), "utf8"),
  ]);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(environment, /BOT_API_TOKEN=/);
  assert.match(schema, /materialHash/);
  assert.match(schema, /proposalRevision/);
  assert.match(schema, /killSwitchEngaged/);
  assert.match(decisionRoute, /status = 'pending'/);
  assert.match(decisionRoute, /expires_at > \?/);
  assert.match(decisionRoute, /material_hash = \?/);
});

test("keeps the newest account and risk row for each mode", async () => {
  const descendingAccounts = [
    { id: "paper-new", mode: "paper", recordedAt: "2026-08-04T16:23:54.000Z" },
    { id: "live-new", mode: "live", recordedAt: "2026-08-04T16:22:00.000Z" },
    { id: "paper-old", mode: "paper", recordedAt: "2026-08-04T14:39:00.000Z" },
    { id: "live-old", mode: "live", recordedAt: "2026-08-04T14:38:00.000Z" },
  ];
  const descendingRisk = [
    { id: "paper-risk-new", mode: "paper", recordedAt: "2026-08-04T16:23:54.000Z" },
    { id: "paper-risk-old", mode: "paper", recordedAt: "2026-08-04T14:39:00.000Z" },
  ];

  assert.deepEqual(firstRowPerMode(descendingAccounts).map((row) => row.id), ["paper-new", "live-new"]);
  assert.deepEqual(firstRowPerMode(descendingRisk).map((row) => row.id), ["paper-risk-new"]);

  const dashboardData = await readFile(new URL("app/lib/dashboard-data.ts", root), "utf8");
  assert.match(dashboardData, /accountSnapshots\)\.orderBy\(desc\(accountSnapshots\.recordedAt\)\)/);
  assert.match(dashboardData, /riskSnapshots\)\.orderBy\(desc\(riskSnapshots\.recordedAt\)\)/);
  assert.match(dashboardData, /firstRowPerMode\(accounts\)/);
  assert.match(dashboardData, /firstRowPerMode\(risk\)/);
});

test("persists optional paper-only watchlist telemetry without implying a connection", async () => {
  const [schema, telemetryRoute, dashboardData, client, freshness, styles, migrationNames] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/bot/telemetry/route.ts", root), "utf8"),
    readFile(new URL("app/lib/dashboard-data.ts", root), "utf8"),
    readFile(new URL("app/dashboard-client.tsx", root), "utf8"),
    readFile(new URL("app/lib/watchlist-freshness.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readdir(new URL("drizzle/", root)),
  ]);
  const migrationBodies = await Promise.all(
    migrationNames.filter((name) => name.endsWith(".sql")).map((name) => readFile(new URL(`drizzle/${name}`, root), "utf8")),
  );
  assert.match(schema, /watchlistStatus/);
  assert.ok(migrationBodies.some((body) => body.includes("CREATE TABLE `watchlist_status`")));
  assert.match(telemetryRoute, /body\.watchlist/);
  assert.match(telemetryRoute, /watchlist\.botManagedCount cannot exceed watchlist\.itemCount/);
  assert.match(telemetryRoute, /ON CONFLICT\(id\) DO UPDATE/);
  assert.match(dashboardData, /watchlist: watchlistRows\[0\] \?\? null/);
  assert.match(client, /Robinhood Options Watchlist/);
  assert.match(client, /awaiting: "Awaiting sync"/);
  assert.match(client, /freshness\?\.label === "Stale" \? "stale" : watchlist\.status/);
  assert.match(client, /watchlistFreshness/);
  assert.match(freshness, /America\/New_York/);
  assert.match(freshness, /Market closed/);
  assert.match(client, /watchlist-panel--\$\{effectiveStatus\}/);
  assert.match(styles, /watchlist-panel--stale \.watchlist-status/);
  assert.match(client, /Paper-only monitoring/);
  assert.match(client, /Real Robinhood execution remains disabled in V1/);
});

test("auto-approves paper proposals only when the operator policy and safety controls allow it", async () => {
  const [environment, server, proposalRoute, commandRoute, dashboardData, client] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("app/lib/server.ts", root), "utf8"),
    readFile(new URL("app/api/bot/proposals/route.ts", root), "utf8"),
    readFile(new URL("app/api/bot/commands/route.ts", root), "utf8"),
    readFile(new URL("app/lib/dashboard-data.ts", root), "utf8"),
    readFile(new URL("app/dashboard-client.tsx", root), "utf8"),
  ]);
  assert.match(environment, /PAPER_AUTO_APPROVE=false/);
  assert.match(server, /PAPER_AUTO_APPROVE/);
  assert.match(proposalRoute, /proposal\.mode !== "paper"/);
  assert.match(proposalRoute, /s\.paused = 0 AND s\.kill_switch_engaged = 0/);
  assert.match(proposalRoute, /p\.expires_at > \?/);
  assert.match(proposalRoute, /paper-auto-policy/);
  assert.match(proposalRoute, /accepted: true/);
  assert.match(proposalRoute, /proposalId: proposal\.id/);
  assert.match(proposalRoute, /materialHash: proposal\.materialHash/);
  assert.doesNotMatch(proposalRoute, /mode = 'live'.*approved/s);
  assert.match(commandRoute, /paperAutoApprove: isPaperAutoApprovalEnabled\(\)/);
  assert.match(commandRoute, /commandRows\.map\(\(\{ decision \}\) => decision\)/);
  assert.match(dashboardData, /paperAutoApprove/);
  assert.match(client, /Paper approvals/);
  assert.match(client, /live execution remains disabled/);
});

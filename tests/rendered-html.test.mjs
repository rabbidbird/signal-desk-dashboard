import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

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

test("persists optional paper-only watchlist telemetry without implying a connection", async () => {
  const [schema, telemetryRoute, dashboardData, client, styles, migrationNames] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/bot/telemetry/route.ts", root), "utf8"),
    readFile(new URL("app/lib/dashboard-data.ts", root), "utf8"),
    readFile(new URL("app/dashboard-client.tsx", root), "utf8"),
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
  assert.match(client, /watchlist-panel--\$\{effectiveStatus\}/);
  assert.match(styles, /watchlist-panel--stale \.watchlist-status/);
  assert.match(client, /Paper-only monitoring/);
  assert.match(client, /Real Robinhood execution remains disabled in V1/);
});

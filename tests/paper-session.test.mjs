import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { validateSnapshot, validateInitialSnapshot, snapshotHash } from "../app/lib/paper-snapshot.ts";
import { registerSession, publishSnapshot, readSession } from "../app/lib/paper-session-store.ts";

const now = Date.parse("2026-09-11T14:30:00Z");
export function initial(session = "draft-paper-fixture", sequence = 1) {
  return { protocol_version: 2, session_id: session, run_id: `fixture-${sequence}`, sequence, captured_at: new Date(now + sequence * 1000).toISOString(),
    account: { initial_cash_cents: 100000, cash_cents: 100000, reserved_cash_cents: 0, equity_cents: 100000, realized_pnl_cents: 0, unrealized_pnl_cents: 0, exposure_cents: 0, peak_equity_cents: 100000, drawdown_cents: 0 }, positions: [], decisions: [],
    coverage: { status: "NOT_STARTED", asset_classes: [], scanned: 0, candidates: 0, truncated: false, as_of: null, detail: "Market research has not started." },
    health: { status: "PAUSED", execution_paused: true, research_paused: true, kill_switch: false, detail: "Trading and research paused.", source_at: null } };
}
async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const dir = new URL("../drizzle/", import.meta.url);
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) sqlite.exec(await readFile(new URL(name, dir), "utf8"));
  sqlite.prepare("UPDATE system_state SET paused=1,kill_switch_engaged=0,reason='paused',version=16,updated_by='test',updated_at=? WHERE id=1").run(new Date(now).toISOString());
  class Statement {
    constructor(sql) { this.sql = sql; this.args = []; }
    bind(...args) { this.args = args; return this; }
    async run() { const result = sqlite.prepare(this.sql).run(...this.args); return { meta: { changes: Number(result.changes) } }; }
    async first() { return sqlite.prepare(this.sql).get(...this.args) ?? null; }
    async all() { return { results: sqlite.prepare(this.sql).all(...this.args) }; }
  }
  return { sqlite, prepare: (sql) => new Statement(sql), async batch(statements) { sqlite.exec("BEGIN IMMEDIATE"); try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } } };
}
test("complete $1000 session validates and partial or inconsistent financial sections fail", async () => {
  const good = validateSnapshot(initial(), now + 2000); validateInitialSnapshot(good);
  for (const mutate of [
    (s) => { delete s.positions; }, (s) => { s.account.cash_cents = 90000; },
    (s) => { s.account.reserved_cash_cents = 100001; }, (s) => { s.account.equity_cents = 1000.5; },
    (s) => { s.account.unrealized_pnl_cents = 1; }, (s) => { s.coverage.status = "COMPLETE"; s.coverage.truncated = true; },
    (s) => { s.health.execution_paused = "true"; }, (s) => { s.arbitrary = "live"; },
  ]) { const bad = initial(); mutate(bad); assert.throws(() => validateSnapshot(bad, now + 2000)); }
  assert.throws(() => validateSnapshot(initial(), now + 125000), /stale/);
  assert.throws(() => validateSnapshot(initial(), now - 10000), /future/);
  assert.equal(await snapshotHash(good), await snapshotHash(validateSnapshot({ ...initial() }, now + 2000)));
});
test("registration creates a paused, unarmed session and preserves all old economic history", async () => {
  const db = await database();
  try {
    db.sqlite.exec("INSERT INTO account_snapshots VALUES(1,'paper','old ledger',10000000,10000000,0,0,0,0,'2026-09-10T14:00:00Z')");
    const s = initial(); await registerSession(db, s, await snapshotHash(s), 16, null);
    const data = await readSession(db);
    assert.equal(data.snapshot.account.equity_cents, 100000);
    assert.equal(data.system.paused, 1); assert.equal(data.system.version, 17);
    assert.equal(data.pointer.execution_armed, 0); assert.equal(data.pointer.research_paused, 1);
    assert.equal(db.sqlite.prepare("SELECT equity_cents FROM account_snapshots").get().equity_cents, 10000000);
  } finally { db.sqlite.close(); }
});
test("a raced pause/version/session reset rolls back every inserted row", async () => {
  const db = await database();
  try {
    for (const version of [15, 17]) {
      await assert.rejects(registerSession(db, initial(), "hash", version, null));
      assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM paper_sessions").get().n, 0);
    }
    db.sqlite.exec("UPDATE system_state SET paused=0");
    await assert.rejects(registerSession(db, initial(), "hash", 16, null));
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM paper_session_snapshots").get().n, 0);
  } finally { db.sqlite.close(); }
});
test("atomic snapshots accept exact duplicates and reject conflicts, delayed and cross-session uploads", async () => {
  const db = await database();
  try {
    const a = initial(); await registerSession(db, a, await snapshotHash(a), 16, null);
    const second = initial(a.session_id, 2); const secondHash = await snapshotHash(second);
    assert.deepEqual(await publishSnapshot(db, second, secondHash), { accepted: true, duplicate: false });
    assert.deepEqual(await publishSnapshot(db, second, secondHash), { accepted: true, duplicate: true });
    const third = initial(a.session_id, 3); await publishSnapshot(db, third, await snapshotHash(third));
    const sameTime = { ...initial(a.session_id, 4), captured_at: third.captured_at };
    assert.equal((await publishSnapshot(db, sameTime, await snapshotHash(sameTime))).accepted, false);
    assert.equal((await publishSnapshot(db, second, secondHash)).accepted, true);
    assert.equal((await readSession(db)).snapshot.sequence, 3);
    const conflict = { ...second, run_id: "changed" };
    assert.equal((await publishSnapshot(db, conflict, await snapshotHash(conflict))).accepted, false);
    const delayed = { ...initial(a.session_id, 4), captured_at: a.captured_at };
    assert.equal((await publishSnapshot(db, delayed, await snapshotHash(delayed))).accepted, false);
    const b = initial("draft-paper-new"); await registerSession(db, b, await snapshotHash(b), 17, a.session_id);
    assert.equal((await publishSnapshot(db, third, await snapshotHash(third))).accepted, false);
    assert.equal((await readSession(db)).snapshot.session_id, b.session_id);
    assert.equal((await readSession(db, a.session_id)).snapshot.sequence, 3);
  } finally { db.sqlite.close(); }
});
test("unarmed sessions cannot resume through the server control predicate", async () => {
  const db = await database();
  try {
    const s = initial(); await registerSession(db, s, await snapshotHash(s), 16, null);
    const result = db.sqlite.prepare("UPDATE system_state SET paused=0 WHERE id=1 AND kill_switch_engaged=0 AND NOT EXISTS (SELECT 1 FROM paper_session_pointer WHERE id=1 AND execution_armed=0)").run();
    assert.equal(result.changes, 0);
  } finally { db.sqlite.close(); }
});

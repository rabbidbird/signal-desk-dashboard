import type { PaperSnapshot } from "./paper-snapshot";

/** One SQL statement per prepare; D1 batch rolls back the whole operation on error. */
export async function registerSession(
  db: D1Database, snapshot: PaperSnapshot, hash: string, expectedControlVersion: number, expectedSessionId: string | null,
) {
  const values = [snapshot.session_id, snapshot.account.initial_cash_cents, snapshot.captured_at];
  const results = await db.batch([
    db.prepare(`INSERT INTO paper_sessions (id, initial_cash_cents, created_at)
      SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM system_state WHERE id=1 AND paused=1 AND version=?)
      AND (SELECT session_id FROM paper_session_pointer WHERE id=1) IS ?`)
      .bind(...values, expectedControlVersion, expectedSessionId),
    // This FK deliberately aborts the batch if the optimistic control/session fence failed.
    db.prepare(`INSERT INTO paper_session_snapshots (session_id, sequence, run_id, material_hash, captured_at, envelope_json)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(snapshot.session_id, snapshot.sequence, snapshot.run_id, hash, snapshot.captured_at, JSON.stringify(snapshot)),
    db.prepare(`INSERT INTO paper_session_pointer (id, session_id, snapshot_sequence, execution_armed, research_paused, updated_at)
      VALUES (1, ?, 1, 0, 1, ?) ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,
      snapshot_sequence=1, execution_armed=0, research_paused=1, updated_at=excluded.updated_at`)
      .bind(snapshot.session_id, snapshot.captured_at),
    db.prepare(`UPDATE system_state SET paused=1, version=version+1, reason='New paper session prepared; awaiting activation',
      updated_by='paper-session-registration', updated_at=? WHERE id=1`).bind(snapshot.captured_at),
  ]);
  return results[0].meta.changes === 1;
}

export async function publishSnapshot(db: D1Database, snapshot: PaperSnapshot, hash: string) {
  const results = await db.batch([
    db.prepare(`INSERT INTO paper_session_snapshots (session_id, sequence, run_id, material_hash, captured_at, envelope_json)
      SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (
        SELECT 1 FROM paper_session_pointer p
        JOIN paper_session_snapshots s ON s.session_id=p.session_id AND s.sequence=p.snapshot_sequence
        JOIN paper_sessions a ON a.id=p.session_id
        WHERE p.id=1 AND p.session_id=? AND p.snapshot_sequence<? AND s.captured_at<? AND a.initial_cash_cents=?
      ) ON CONFLICT DO NOTHING`)
      .bind(snapshot.session_id, snapshot.sequence, snapshot.run_id, hash, snapshot.captured_at, JSON.stringify(snapshot),
        snapshot.session_id, snapshot.sequence, snapshot.captured_at, snapshot.account.initial_cash_cents),
    db.prepare(`UPDATE paper_session_pointer SET snapshot_sequence=?, updated_at=?
      WHERE id=1 AND session_id=? AND snapshot_sequence<? AND EXISTS (
        SELECT 1 FROM paper_session_snapshots WHERE session_id=? AND sequence=? AND material_hash=?
      )`).bind(snapshot.sequence, snapshot.captured_at, snapshot.session_id, snapshot.sequence, snapshot.session_id, snapshot.sequence, hash),
  ]);
  const existing = await db.prepare("SELECT material_hash FROM paper_session_snapshots WHERE session_id=? AND sequence=?")
    .bind(snapshot.session_id, snapshot.sequence).first<{ material_hash: string }>();
  const pointer = await db.prepare("SELECT session_id FROM paper_session_pointer WHERE id=1").first<{ session_id: string }>();
  return { accepted: existing?.material_hash === hash && pointer?.session_id === snapshot.session_id, duplicate: results[0].meta.changes === 0 };
}

export async function readSession(db: D1Database, sessionId?: string) {
  // Pointer, controls and its complete envelope are read in one SQLite statement.
  const row = await db.prepare(`SELECT p.session_id, p.snapshot_sequence, p.execution_armed, p.research_paused,
      c.paused, c.kill_switch_engaged, c.version, c.reason, c.updated_at,
      (SELECT s.envelope_json FROM paper_session_snapshots s
        WHERE s.session_id=COALESCE(?,p.session_id)
        AND (? IS NOT NULL OR s.sequence=p.snapshot_sequence)
        ORDER BY s.sequence DESC LIMIT 1) AS envelope_json
    FROM (SELECT 1) anchor LEFT JOIN paper_session_pointer p ON p.id=1 LEFT JOIN system_state c ON c.id=1`)
    .bind(sessionId ?? null, sessionId ?? null).first<{
      session_id: string | null; snapshot_sequence: number; execution_armed: number; research_paused: number;
      paused: number; kill_switch_engaged: number; version: number; reason: string; updated_at: string; envelope_json: string | null;
    }>();
  const sessions = await db.prepare("SELECT id, initial_cash_cents, created_at FROM paper_sessions ORDER BY created_at DESC LIMIT 100").all();
  const pointer = row?.session_id ? { session_id: row.session_id, snapshot_sequence: row.snapshot_sequence, execution_armed: row.execution_armed, research_paused: row.research_paused } : null;
  const system = row?.version ? { paused: row.paused, kill_switch_engaged: row.kill_switch_engaged, version: row.version, reason: row.reason, updated_at: row.updated_at } : null;
  return { snapshot: row?.envelope_json ? JSON.parse(row.envelope_json) as PaperSnapshot : null, sessions: sessions.results, pointer, system, server_time: new Date().toISOString() };
}

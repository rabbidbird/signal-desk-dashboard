import { getD1 } from "@/db";
import { asInteger, asString, readJsonObject, RequestError, requireBot, routeError } from "@/app/lib/server";
import { SnapshotError, snapshotHash, validateInitialSnapshot, validateSnapshot } from "@/app/lib/paper-snapshot";
import { publishSnapshot, readSession, registerSession } from "@/app/lib/paper-session-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireBot(request);
    return Response.json(await readSession(getD1()), { headers: { "cache-control": "no-store" } });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    await requireBot(request);
    const body = await readJsonObject(request, 512 * 1024);
    const action = asString(body.action, "action", { max: 16 });
    const snapshot = validateSnapshot(body.snapshot, Date.now(), false);
    const hash = await snapshotHash(snapshot);
    const db = getD1();
    if (action === "register") {
      validateInitialSnapshot(snapshot);
      const version = asInteger(body.expected_control_version, "expected_control_version", { min: 1 }) as number;
      const expectedSession = asString(body.expected_session_id, "expected_session_id", { optional: true, max: 100 });
      const prior = await db.prepare(`SELECT s.material_hash, p.session_id FROM paper_session_snapshots s
        LEFT JOIN paper_session_pointer p ON p.id=1 WHERE s.session_id=? AND s.sequence=1`).bind(snapshot.session_id).first<{ material_hash: string; session_id: string }>();
      if (prior) {
        if (prior.material_hash !== hash || prior.session_id !== snapshot.session_id) throw new RequestError("Session registration conflicts with existing history", 409);
        return Response.json({ accepted: true, duplicate: true, session_id: snapshot.session_id });
      }
      validateSnapshot(body.snapshot);
      try { await registerSession(db, snapshot, hash, version, expectedSession); }
      catch { throw new RequestError("Session registration requires the current paused control version and session", 409); }
      return Response.json({ accepted: true, duplicate: false, session_id: snapshot.session_id }, { status: 201 });
    }
    if (action !== "snapshot") throw new RequestError("Unsupported paper session action");
    const existing = await db.prepare("SELECT material_hash FROM paper_session_snapshots WHERE session_id=? AND sequence=?").bind(snapshot.session_id, snapshot.sequence).first<{ material_hash: string }>();
    if (!existing) validateSnapshot(body.snapshot);
    const result = await publishSnapshot(db, snapshot, hash);
    if (!result.accepted) throw new RequestError("Snapshot is older, conflicting, or belongs to another session", 409);
    return Response.json({ ...result, session_id: snapshot.session_id, sequence: snapshot.sequence });
  } catch (error) {
    if (error instanceof SnapshotError) return Response.json({ error: error.message }, { status: 400 });
    return routeError(error);
  }
}

import { getD1 } from "@/db";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readSession, startPaperSession } from "@/app/lib/paper-session-store";
import { asInteger, asString, readJsonObject, requireBrowserWrite, RequestError, routeError } from "@/app/lib/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!await getChatGPTUser()) throw new RequestError("Sign in with ChatGPT to continue", 401);
    const session = new URL(request.url).searchParams.get("session") ?? undefined;
    if (session && !/^[A-Za-z0-9:_-]{1,100}$/.test(session)) throw new RequestError("Invalid session identity");
    return Response.json(await readSession(getD1(), session), { headers: { "cache-control": "no-store" } });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireBrowserWrite(request);
    const body = await readJsonObject(request);
    if (body.action !== "start_paper") throw new RequestError("Unsupported session action");
    const sessionId = asString(body.session_id, "session_id", { max: 100 }) as string;
    const version = asInteger(body.control_version, "control_version", { min: 1 }) as number;
    if (!/^[A-Za-z0-9:_-]{1,100}$/.test(sessionId)) throw new RequestError("Invalid session identity");
    if (!await startPaperSession(getD1(), sessionId, version, user.userId)) {
      throw new RequestError("Start requires the current paused session, a cleared kill switch, no pending reservation, and a fresh worker snapshot. Refresh after the worker checks readiness.", 409);
    }
    return Response.json(await readSession(getD1()), { headers: { "cache-control": "no-store" } });
  } catch (error) { return routeError(error); }
}

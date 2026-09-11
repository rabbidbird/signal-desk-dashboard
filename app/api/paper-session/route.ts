import { getD1 } from "@/db";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readSession } from "@/app/lib/paper-session-store";
import { RequestError, routeError } from "@/app/lib/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!await getChatGPTUser()) throw new RequestError("Sign in with ChatGPT to continue", 401);
    const session = new URL(request.url).searchParams.get("session") ?? undefined;
    if (session && !/^[A-Za-z0-9:_-]{1,100}$/.test(session)) throw new RequestError("Invalid session identity");
    return Response.json(await readSession(getD1(), session), { headers: { "cache-control": "no-store" } });
  } catch (error) { return routeError(error); }
}

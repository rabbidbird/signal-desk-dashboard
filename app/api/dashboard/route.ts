import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDashboardData } from "@/app/lib/dashboard-data";
import { routeError } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in with ChatGPT to continue" }, { status: 401 });
    return Response.json(await getDashboardData(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}

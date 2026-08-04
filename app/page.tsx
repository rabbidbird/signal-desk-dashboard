import { requireChatGPTUser } from "@/app/chatgpt-auth";
import DashboardClient from "@/app/dashboard-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <DashboardClient user={{ displayName: user.displayName, email: user.email }} />;
}

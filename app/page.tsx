import { requireChatGPTUser } from "@/app/chatgpt-auth";
import PaperSessionClient from "@/app/paper-session-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <PaperSessionClient user={{ displayName: user.displayName, email: user.email }} />;
}

import { requireChatGPTUser } from "@/app/chatgpt-auth";
import DashboardClient from "@/app/dashboard-client";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function LegacyHistory() {
  const user = await requireChatGPTUser("/history/legacy");
  return <><div className="legacy-history-banner"><Link href="/">Current paper session</Link><strong>Prior bot history — read only</strong><span>Old holdings and totals remain in their original ledger.</span></div><DashboardClient readOnly user={{ displayName: user.displayName, email: user.email }} /></>;
}

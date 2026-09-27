import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { getPendingApprovalCount } from "@/lib/approvals";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const pendingApprovalCount = await getPendingApprovalCount(ctx);

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar tree={ctx.menuTree} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header ctx={ctx} pendingApprovalCount={pendingApprovalCount} />
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}

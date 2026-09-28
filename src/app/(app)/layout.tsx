import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { getPendingApprovalCount } from "@/lib/approvals";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ShellSkeleton } from "@/components/ShellSkeleton";
import { MobileNavProvider } from "@/components/MobileNavContext";

// The session/RBAC lookup here is runtime data (reads the session cookie),
// so Next.js cannot show an instant loading state for it automatically -
// per the framework's own docs, an uncached fetch in a layout blocks
// navigation entirely unless it's wrapped in its own Suspense boundary.
// This was the layout that ran on every single navigation, so it was the
// single biggest source of "clicking anywhere feels slow": isolating it
// here means the skeleton below paints the instant a link is clicked,
// before the DB round trip even starts.
async function Shell({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const pendingApprovalCount = await getPendingApprovalCount(ctx);

  // Vercel sets this automatically at build time - a visible way to confirm
  // which commit is actually live, since deploy dashboards and stale mobile
  // caches otherwise make that impossible to eyeball from the device itself.
  const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7);

  return (
    <MobileNavProvider>
      <div className="flex h-full min-h-screen">
        <Sidebar tree={ctx.menuTree} buildId={buildId} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header ctx={ctx} pendingApprovalCount={pendingApprovalCount} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

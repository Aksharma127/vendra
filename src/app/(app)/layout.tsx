import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { getPendingApprovalCount } from "@/lib/approvals";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ShellSkeleton } from "@/components/ShellSkeleton";
import { MobileNavProvider } from "@/components/MobileNavContext";
import { NavProgress } from "@/components/NavProgress";
import { ToastProvider } from "@/components/Toaster";
import { CommandPalette } from "@/components/CommandPalette";
import type { MenuNode } from "@/lib/auth-context";

// Every page in the user's own menu, for the search palette's "Go to" list.
function flatten(tree: MenuNode[]): { label: string; path: string }[] {
  return tree.flatMap((n) => (n.path ? [{ label: n.label, path: n.path }] : flatten(n.children)));
}

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
        <Sidebar tree={ctx.menuTree} buildId={buildId} badges={{ "/purchase-requests/queue": pendingApprovalCount }} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header ctx={ctx} pendingApprovalCount={pendingApprovalCount} />
          <main className="flex-1 overflow-x-hidden p-4 sm:p-6 animate-fade-in">{children}</main>
        </div>
      </div>
      {ctx.hasBusinessRole && <CommandPalette pages={flatten(ctx.menuTree)} canCreate={ctx.capabilities.has("pr:create")} />}
    </MobileNavProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Toasts live above the Suspense boundary so a confirmation survives the
    // router.refresh() that follows every workflow action.
    <ToastProvider>
      {/* Outside the Suspense boundary so it is live from first paint. */}
      <NavProgress />
      <Suspense fallback={<ShellSkeleton />}>
        <Shell>{children}</Shell>
      </Suspense>
    </ToastProvider>
  );
}

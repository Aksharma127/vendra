// Instant fallback for the (app) shell's own auth/session Suspense boundary.
// Sized to match Sidebar (w-60) and Header (h-14) so nothing jumps when the
// real shell swaps in - this is what the browser paints the moment a nav
// click fires, before the session/RBAC lookup has even started.
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/60 ${className}`} />;
}

export function ShellSkeleton() {
  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-60 shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/40" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
        <div className="flex-1 py-3 px-2 space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-line bg-surface flex items-center justify-between px-5 shrink-0">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-8 w-8 rounded-full" />
        </header>
        <main className="flex-1 p-6">
          <SkeletonBlock className="h-5 w-48 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24 w-full" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

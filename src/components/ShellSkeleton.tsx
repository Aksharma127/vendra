// Instant fallback for the (app) shell's own auth/session Suspense boundary.
// Sized to match Sidebar (w-60) and Header (h-14) so nothing jumps when the
// real shell swaps in - this is what the browser paints the moment a nav
// click fires, before the session/RBAC lookup has even started.
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function ShellSkeleton() {
  return (
    <div className="flex h-full min-h-screen">
      {/* Desktop only: on phones the real sidebar is an off-canvas drawer, so
          painting a 240px column here made the first frame look broken. */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-line bg-surface flex-col">
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
        <header className="h-14 border-b border-line bg-surface flex items-center justify-between px-3 sm:px-5 shrink-0">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-8 w-8 lg:hidden" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <SkeletonBlock className="h-8 w-8 rounded-full" />
        </header>
        <main className="flex-1 p-4 sm:p-6">
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

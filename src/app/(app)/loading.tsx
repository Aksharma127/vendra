// Automatically wraps every page under the (app) shell in a Suspense
// boundary. Without this, a route with its own data fetching (reports,
// dashboard, admin lists) left the screen frozen on the previous page until
// the whole new page resolved - clicking felt unresponsive even once the
// underlying queries got fast. This gives instant feedback that the click
// registered, which is most of what "feels slow" actually is.
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/60 ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-line rounded p-5 space-y-3">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-6 w-14" />
          </div>
        ))}
      </div>
      <div className="bg-surface border border-line rounded p-5 space-y-3">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-5/6" />
        <SkeletonBlock className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// Route-shaped placeholders for loading.tsx files. Each one mirrors the real
// page's layout closely, so when content streams in nothing jumps around -
// the eye reads it as the page "filling in" rather than a swap.

function S({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-surface border border-line rounded ${className}`}>{children}</div>;
}

function Title({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-6">
      <div className="space-y-2">
        <S className="h-5 w-52" />
        <S className="h-3.5 w-72 max-w-[70vw]" />
      </div>
      {action && <S className="h-9 w-32 hidden sm:block" />}
    </div>
  );
}

function TableRows({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div>
      <div className="flex gap-4 px-5 py-3 border-b border-line">
        {Array.from({ length: cols }).map((_, i) => (
          <S key={i} className={`h-3 ${i === 1 ? "flex-[2]" : "flex-1"}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-b-0">
          {Array.from({ length: cols }).map((_, i) => (
            <S key={i} className={`h-3.5 ${i === 1 ? "flex-[2]" : "flex-1"} ${i === cols - 1 ? "max-w-24 h-5 rounded-full" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Title action />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <S className="h-8 w-8 rounded-full" />
            <S className="h-3 w-28" />
            <S className="h-6 w-12" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 flex items-end justify-between">
            <div className="space-y-2">
              <S className="h-3 w-24" />
              <S className="h-6 w-32" />
              <S className="h-3 w-20" />
            </div>
            <S className="h-7 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <div className="px-5 py-4 border-b border-line flex justify-between">
            <S className="h-4 w-28" />
            <S className="h-3 w-20" />
          </div>
          <div className="p-5">
            {/* faux chart: gridlines + a rising bar silhouette */}
            <div className="h-44 flex items-end gap-3">
              {[38, 52, 46, 64, 72, 88].map((h, i) => (
                <div key={i} className="flex-1" style={{ height: `${h}%` }}>
                  <S className="h-full w-full rounded-t" />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="px-5 py-4 border-b border-line">
            <S className="h-4 w-32" />
          </div>
          <div className="p-5 flex items-center gap-5">
            <S className="h-32 w-32 rounded-full shrink-0" />
            <div className="space-y-3 flex-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <S key={i} className="h-3 w-full" />
              ))}
            </div>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <div className="px-5 py-4 border-b border-line">
              <S className="h-4 w-32" />
            </div>
            <div className="p-5 space-y-4">
              {[92, 74, 60, 44, 30].map((w, j) => (
                <div key={j} className="space-y-1.5">
                  <S className="h-3 w-1/2" />
                  <div className="h-2 rounded-full bg-page-bg">
                    <S className="h-2 rounded-full" style={{ width: `${w}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ filters = true, action = false, rows = 8 }: { filters?: boolean; action?: boolean; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Title action={action} />
      {filters && (
        <div className="flex flex-wrap gap-2 mb-4">
          <S className="h-9 w-56 max-w-full" />
          <S className="h-9 w-32" />
          <S className="h-9 w-32" />
        </div>
      )}
      <Card className="overflow-hidden">
        <TableRows rows={rows} />
      </Card>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <S className="h-3.5 w-28 mb-4" />
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="space-y-2">
          <S className="h-6 w-64 max-w-[80vw]" />
          <S className="h-3.5 w-44" />
        </div>
        <S className="h-6 w-36 rounded-full" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <S className="h-3 w-20" />
                <S className="h-4 w-3/4" />
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2">
            <S className="h-3 w-24" />
            <S className="h-3.5 w-full" />
            <S className="h-3.5 w-5/6" />
          </div>
        </Card>
        <Card className="p-5 space-y-5">
          <S className="h-4 w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <S className="h-7 w-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <S className="h-3.5 w-4/5" />
                <S className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Title />
      <Card className="p-5 sm:p-6 max-w-2xl space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <S className="h-3 w-28" />
            <S className={`${i === 4 ? "h-20" : "h-9"} w-full`} />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <S className="h-9 w-28" />
          <S className="h-9 w-20" />
        </div>
      </Card>
    </div>
  );
}

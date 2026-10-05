import Link from "next/link";

/** Plain links, so paging works without JS and survives a refresh / share. */
export function Pager({
  page,
  pageSize,
  total,
  href,
}: {
  page: number;
  pageSize: number;
  total: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "px-3 py-1.5 rounded border border-line text-sm transition-colors";
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-line text-xs text-graphite">
      <span>
        {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${btn} text-ink hover:bg-page-bg`}>
            Previous
          </Link>
        ) : (
          <span className={`${btn} text-graphite/50`}>Previous</span>
        )}
        <span className="hidden sm:inline">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={`${btn} text-ink hover:bg-page-bg`}>
            Next
          </Link>
        ) : (
          <span className={`${btn} text-graphite/50`}>Next</span>
        )}
      </div>
    </div>
  );
}

export function pageParam(v: string | string[] | undefined) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

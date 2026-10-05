import type { TimelineEntry } from "@/lib/workflow/route";
import { UserAvatar } from "@/components/UserAvatar";
import { formatDateTime, formatRelative } from "@/lib/format";

const TONE_TEXT: Record<TimelineEntry["tone"], string> = {
  neutral: "text-ink",
  good: "text-success",
  warn: "text-warning",
  bad: "text-danger",
};

/** Everything that happened to a request, oldest first, in plain sentences. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-graphite">Nothing has happened yet. Submit the draft to start the approval route.</p>;
  }
  return (
    <ol className="relative space-y-5">
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-3">
          {i < entries.length - 1 && <span aria-hidden="true" className="absolute left-[13px] top-8 -bottom-5 w-px bg-line" />}
          <UserAvatar name={e.actorName} size="sm" className="relative z-[1] ring-2 ring-surface" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm text-ink">
                <span className="font-medium">{e.actorName}</span> <span className={TONE_TEXT[e.tone]}>{e.text}</span>
              </p>
              <time dateTime={e.at.toISOString()} title={formatDateTime(e.at)} className="shrink-0 text-xs text-graphite">
                {formatRelative(e.at)}
              </time>
            </div>
            <p className="text-xs text-graphite">{e.role}</p>
            {e.comment && (
              <blockquote className="mt-2 rounded-r border-l-2 border-line bg-page-bg/70 px-3 py-2 text-sm text-ink">{e.comment}</blockquote>
            )}
            {e.note && <p className="mt-1.5 text-xs text-graphite">{e.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

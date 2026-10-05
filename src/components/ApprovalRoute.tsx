import type { Stage, StageState } from "@/lib/workflow/route";
import { formatShortDate } from "@/lib/format";

// The approval route: one desk per column (one row on phones). Decisions -
// division and finance - are shown as an ink stamp, like the routing slip
// clipped to a paper requisition; every other desk is plain text, so the
// stamps keep their meaning.

const INK: Record<StageState, string> = {
  done: "var(--color-success)",
  current: "var(--color-accent)",
  returned: "var(--color-warning)",
  rejected: "var(--color-danger)",
  withdrawn: "var(--color-graphite)",
  skipped: "var(--color-graphite)",
  upcoming: "var(--color-line)",
};

const VERDICT: Partial<Record<StageState, string>> = {
  done: "Approved",
  returned: "Returned",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function Node({ state }: { state: StageState }) {
  const ink = INK[state];
  const base = "relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center rounded-full";
  if (state === "upcoming") return <span className={`${base} border-2 border-line bg-surface`} />;
  if (state === "skipped") return <span className={`${base} border-2 border-dashed border-graphite/50 bg-surface`} />;
  if (state === "current")
    return (
      <span className={`${base} route-current border-2 bg-surface`} style={{ borderColor: ink }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ink }} />
      </span>
    );
  return (
    <span className={base} style={{ backgroundColor: ink }}>
      <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === "done" && <path d="M5 10.5l3.2 3.2L15 7" />}
        {state === "rejected" && <path d="M6 6l8 8M14 6l-8 8" />}
        {state === "returned" && <path d="M8 6L4.5 9.5 8 13M5 9.5h7a3.5 3.5 0 0 1 0 7h-1.5" />}
        {state === "withdrawn" && <path d="M6 10h8" />}
      </svg>
    </span>
  );
}

function Stamp({ stage, verdict, ink: inkOverride }: { stage: Stage; verdict?: string; ink?: string }) {
  const ink = inkOverride ?? INK[stage.state];
  const word = verdict ?? VERDICT[stage.state];
  if (!word) return null;
  return (
    <div
      className="mt-2 inline-block max-w-full rounded-[3px] border-[1.5px] px-2 py-1 text-[11px] leading-tight"
      // Explicit transform, not a rotate-* utility: Tailwind v4's rotate
      // utilities emit the standalone `rotate` property, which older Android
      // WebViews ignore.
      style={{ color: ink, borderColor: `color-mix(in srgb, ${ink} 70%, transparent)`, transform: "rotate(-2deg)" }}
    >
      <div className="font-semibold tracking-wide">{word}</div>
      {stage.people.map((p) => (
        <div key={p}>{p}</div>
      ))}
      {stage.at && <div className="opacity-80">{formatShortDate(stage.at)}</div>}
    </div>
  );
}

function Lines({ lines, lead }: { lines: (string | null)[]; lead?: boolean }) {
  const shown = lines.filter(Boolean) as string[];
  return (
    <div className="mt-1 space-y-0.5 text-xs leading-snug">
      {shown.map((l, i) => (
        <div key={i} className={i === 0 && lead ? "font-medium text-accent" : "text-graphite"}>
          {l}
        </div>
      ))}
    </div>
  );
}

function Detail({ stage }: { stage: Stage }) {
  const decisionDesk = stage.key === "division" || stage.key === "finance";
  // Decisions are stamped; everything else is plain text.
  if (decisionDesk && VERDICT[stage.state]) {
    return (
      <>
        <Stamp stage={stage} />
        {stage.note && <Lines lines={[stage.note]} />}
      </>
    );
  }
  if (stage.state === "withdrawn") {
    return <Lines lines={["Discarded", stage.people[0] ?? null, stage.at ? formatShortDate(stage.at) : null]} />;
  }
  if (stage.state === "current") {
    if (stage.key === "finance" && stage.people.length) {
      // First of two finance approvals given: stamp it, and say what's left.
      return (
        <>
          <Lines lines={["Waiting for the second"]} lead />
          <Stamp stage={stage} verdict="Approved, 1 of 2" ink="var(--color-success)" />
        </>
      );
    }
    if (stage.key === "raised") return <Lines lines={[stage.people.length ? "Back for changes" : "Draft, not sent"]} lead />;
    return <Lines lines={["Waiting here", stage.note]} lead />;
  }
  if (stage.state === "skipped") return <Lines lines={["Skipped", stage.note]} />;
  return <Lines lines={[stage.people.join(", ") || null, stage.at ? formatShortDate(stage.at) : null, stage.note]} />;
}

export function ApprovalRoute({ stages }: { stages: Stage[] }) {
  const reached = (s: Stage | undefined) => !!s && s.state !== "upcoming";
  return (
    <ol className="grid grid-cols-1 gap-0 md:grid-cols-6" aria-label="Approval route">
      {stages.map((stage, i) => {
        const next = stages[i + 1];
        const solid = reached(next);
        const lineColor = solid ? "var(--color-success)" : "var(--color-line)";
        return (
          <li
            key={stage.key}
            className="relative flex gap-3 pb-5 last:pb-0 md:block md:pb-0 md:pr-3"
            aria-current={stage.state === "current" ? "step" : undefined}
          >
            {/* connector to the next desk */}
            {next && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute left-[9px] top-5 bottom-0 w-0.5 md:hidden"
                  style={solid ? { backgroundColor: lineColor } : { backgroundImage: `linear-gradient(${lineColor} 50%, transparent 50%)`, backgroundSize: "2px 6px" }}
                />
                <span
                  aria-hidden="true"
                  className="absolute left-5 right-0 top-[9px] hidden h-0.5 md:block"
                  style={solid ? { backgroundColor: lineColor } : { backgroundImage: `linear-gradient(90deg, ${lineColor} 50%, transparent 50%)`, backgroundSize: "6px 2px" }}
                />
              </>
            )}
            <Node state={stage.state} />
            <div className="min-w-0 md:mt-2">
              <div className={`text-sm font-medium ${stage.state === "upcoming" ? "text-graphite" : "text-ink"}`}>{stage.label}</div>
              <Detail stage={stage} />
            </div>
            <span className="sr-only">
              {stage.state === "upcoming" ? "not reached yet" : stage.state === "current" ? "current step" : stage.state}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

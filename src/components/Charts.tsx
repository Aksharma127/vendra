// Dependency-free SVG charts. Server components: they render to static SVG
// on the server, so the dashboard ships zero extra JS for them and they paint
// immediately on slow phones. Hover detail uses native SVG <title> tooltips
// (works with touch long-press too). Animations are CSS-only and use
// `transform`/`stroke-dashoffset` - never the standalone `translate`
// property, which older Android WebViews ignore.

export function compactINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `₹${Math.round(n / 1e3)}K`;
  return `₹${Math.round(n)}`;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export type Series = { name: string; color: string; values: number[] };

/** Multi-series area/line chart over categorical x labels (e.g. months). */
export function AreaChart({
  labels,
  series,
  format = compactINR,
  height = 220,
}: {
  labels: string[];
  series: Series[];
  format?: (n: number) => string;
  height?: number;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 52, r: 12, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => pad.l + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={series.map((s) => s.name).join(" vs ")}>
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`area-grad-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={i === 0 ? undefined : "3 4"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-graphite)">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            // Edge labels anchor inward so a longer last label ("Oct, so far") isn't clipped.
            textAnchor={labels.length > 1 && i === labels.length - 1 ? "end" : i === 0 && labels.length > 1 ? "start" : "middle"}
            fontSize="11"
            fill="var(--color-graphite)"
          >
            {l}
          </text>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const area = `M${x(0)},${y(0)} L${pts.replaceAll(" ", " L")} L${x(s.values.length - 1)},${y(0)} Z`;
          return (
            <g key={si}>
              <path d={area} fill={`url(#area-grad-${si})`} className="chart-fade" />
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-draw" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--color-surface)" stroke={s.color} strokeWidth="2" className="chart-fade">
                  <title>{`${s.name} · ${labels[i]}: ${format(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-4 mt-2 pl-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-graphite">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export type Segment = { label: string; value: number; color: string };

/** Donut with centre total and a legend. */
export function DonutChart({ segments, centerLabel }: { segments: Segment[]; centerLabel: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
      <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0" role="img" aria-label={centerLabel}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-page-bg)" strokeWidth="16" />
        {/* SVG transform attribute (not a CSS rotate utility) so segments start at 12 o'clock on every browser */}
        <g transform="rotate(-90 70 70)">
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s, i) => {
              const len = (s.value / total) * C;
              const el = (
                <circle
                  key={i}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(len - 1.5, 0.01)} ${C}`}
                  strokeDashoffset={-offset}
                  className="chart-fade"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <title>{`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
        </g>
        <g>
          <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="600" fill="var(--color-ink)">
            {total}
          </text>
          <text x="70" y="86" textAnchor="middle" fontSize="10" fill="var(--color-graphite)">
            {centerLabel}
          </text>
        </g>
      </svg>
      <ul className="space-y-2 min-w-0 flex-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-graphite truncate flex-1">{s.label}</span>
            <span className="text-ink font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars - categories, divisions, vendors. */
export function BarList({
  rows,
  format = compactINR,
  color = "var(--color-accent)",
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}`}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-sm text-ink truncate">{r.label}</span>
            <span className="text-xs text-graphite tabular-nums shrink-0">
              {r.hint && <span className="mr-2">{r.hint}</span>}
              <span className="text-ink font-medium">{format(r.value)}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-page-bg overflow-hidden">
            <div
              className="h-full rounded-full chart-grow-x"
              style={{ width: `${(r.value / max) * 100}%`, background: color, opacity: 1 - i * 0.1, animationDelay: `${i * 50}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tiny inline trend line for KPI cards. */
export function Sparkline({ values, color = "var(--color-accent)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const W = 96;
  const H = 28;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-7" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-draw" />
    </svg>
  );
}

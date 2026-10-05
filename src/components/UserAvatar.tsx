// Initials avatar with a stable colour per person (hash of the name), so the
// same person is always the same colour across the activity feed and tables.
const TONES = [
  "bg-accent text-on-accent",
  "bg-success text-on-accent",
  "bg-warning text-on-accent",
  "bg-danger text-on-accent",
  "bg-graphite text-on-accent",
  "bg-[color-mix(in_srgb,var(--color-accent)_70%,var(--color-graphite))] text-on-accent",
  "bg-[color-mix(in_srgb,var(--color-accent)_45%,var(--color-danger))] text-on-accent",
];

const SIZES = { sm: "h-7 w-7 text-[11px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" } as const;

export function UserAvatar({
  name,
  size = "md",
  className = "",
}: {
  name: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const label = name?.trim() || "System";
  const initials = label
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = name ? TONES[h % TONES.length] : "bg-page-bg text-graphite";

  return (
    <div className={`rounded-full flex items-center justify-center font-semibold select-none ${SIZES[size]} ${tone} ${className}`} title={label} aria-hidden="true">
      {initials}
    </div>
  );
}

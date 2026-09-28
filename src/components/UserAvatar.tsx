// Initials avatar with a stable colour per person (hash of the name), so the
// same person is always the same colour across the activity feed and tables.
const TONES = [
  "bg-accent text-white",
  "bg-success text-white",
  "bg-warning text-white",
  "bg-danger text-white",
  "bg-graphite text-white",
  "bg-[#3b5b7a] text-white",
  "bg-[#6b4f8a] text-white",
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

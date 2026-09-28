// Soft multi-colour background for the sign-in screen only. Radial gradients
// (not filter: blur, which is expensive on budget Android GPUs), animated with
// transform alone, and frozen under prefers-reduced-motion. The app itself
// keeps a calm single-accent background so chart colours stay meaningful.
const FIELDS = [
  // position / size / colour / drift class
  { cls: "drift-a", style: { top: "-18%", left: "-12%", width: "62vmax", height: "62vmax", background: "radial-gradient(closest-side, rgba(30,58,95,0.14), rgba(30,58,95,0) 70%)" } },
  { cls: "drift-b", style: { top: "-10%", right: "-18%", width: "55vmax", height: "55vmax", background: "radial-gradient(closest-side, rgba(20,160,150,0.26), rgba(20,160,150,0) 70%)" } },
  { cls: "drift-c", style: { bottom: "-25%", left: "15%", width: "60vmax", height: "60vmax", background: "radial-gradient(closest-side, rgba(120,85,200,0.24), rgba(120,85,200,0) 70%)" } },
  { cls: "drift-b", style: { bottom: "-20%", right: "-10%", width: "40vmax", height: "40vmax", background: "radial-gradient(closest-side, rgba(214,140,60,0.14), rgba(214,140,60,0) 70%)" } },
];

export function Aurora({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {FIELDS.map((f, i) => (
        <div
          key={i}
          className={`absolute rounded-full will-change-transform ${f.cls}`}
          style={{ ...f.style, opacity: tone === "dark" ? 0.9 : 1, mixBlendMode: tone === "dark" ? "screen" : "normal" }}
        />
      ))}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Thin progress bar across the top of the viewport, started the instant an
// internal link is clicked and finished when the new route commits. This is
// the feedback that was missing on mobile: links inside the closed drawer are
// off-screen, so Next.js never prefetches them, and a tap would otherwise sit
// silently on the old page while the server renders the next one.
export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const startedFrom = useRef<string | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Only track real page changes; query-only changes don't alter pathname.
      if (url.pathname === window.location.pathname) return;
      startedFrom.current = window.location.pathname;
      setState("loading");
      if (safety.current) clearTimeout(safety.current);
      safety.current = setTimeout(() => setState("idle"), 12000);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (startedFrom.current && startedFrom.current !== pathname) {
      startedFrom.current = null;
      if (safety.current) clearTimeout(safety.current);
      setState("done");
      const t = setTimeout(() => setState("idle"), 320);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  if (state === "idle") return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[3px] pointer-events-none" aria-hidden="true">
      <div
        className={`h-full bg-accent shadow-[0_0_8px_var(--color-accent)] ${state === "loading" ? "nav-progress" : ""}`}
        style={
          state === "done"
            ? { transform: "scaleX(1)", transformOrigin: "left center", opacity: 0, transition: "transform 150ms ease-out, opacity 250ms ease 120ms" }
            : undefined
        }
      />
    </div>
  );
}

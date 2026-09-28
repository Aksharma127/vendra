"use client";

import { useMobileNav } from "./MobileNavContext";

export function MobileNavToggle() {
  const { open, toggle } = useMobileNav();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className="lg:hidden shrink-0 flex items-center justify-center h-8 w-8 rounded text-graphite hover:text-ink hover:bg-page-bg transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
        {open ? (
          <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
        ) : (
          <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

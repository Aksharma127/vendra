"use client";

import { useSyncExternalStore } from "react";
import { openSearch } from "./CommandPalette";

// "⌘K" on Apple devices, "Ctrl K" elsewhere. Server render says "Ctrl K";
// useSyncExternalStore swaps it after hydration without a mismatch warning.
const subscribe = () => () => {};
const isApple = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

export function SearchButton() {
  const apple = useSyncExternalStore(subscribe, isApple, () => false);
  return (
    <>
      {/* Desktop: looks like a search field */}
      <button
        type="button"
        onClick={openSearch}
        className="hidden h-9 w-full max-w-xs items-center gap-2.5 rounded-md border border-line bg-page-bg/60 px-3 text-sm text-graphite transition-colors hover:border-graphite/40 hover:text-ink md:flex"
      >
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M12.7 12.7L17 17" />
        </svg>
        <span className="flex-1 text-left">Search requests and orders</span>
        <kbd className="rounded border border-line bg-surface px-1.5 font-sans text-[11px] leading-5 text-graphite">{apple ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      {/* Phones: an icon */}
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-full text-graphite transition-colors hover:bg-page-bg hover:text-ink md:hidden"
      >
        <svg viewBox="0 0 20 20" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M12.7 12.7L17 17" />
        </svg>
      </button>
    </>
  );
}

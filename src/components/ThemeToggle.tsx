"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];

/**
 * The stored choice lives in localStorage, which is outside React, so it is
 * read through useSyncExternalStore rather than an effect: that keeps the
 * server render ("system") and the hydrated client render consistent without
 * setting state inside an effect.
 */
let listeners: (() => void)[] = [];

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  // Another tab changing the theme should update this one too.
  const onStorage = (e: StorageEvent) => e.key === THEME_STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener("storage", onStorage);
  };
}

const serverTheme = (): Theme => "system";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice still applies for this page.
  }
  for (const l of [...listeners]) l();
}

const LABEL: Record<Theme, string> = { system: "Match system", light: "Light", dark: "Dark" };

function Icon({ theme }: { theme: Theme }) {
  if (theme === "light")
    return (
      <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.4v1.8M10 15.8v1.8M17.6 10h-1.8M4.2 10H2.4M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3M15.4 15.4l-1.3-1.3M5.9 5.9L4.6 4.6" />
      </svg>
    );
  if (theme === "dark")
    return (
      <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16.5 11.8A7 7 0 0 1 8.2 3.5a7 7 0 1 0 8.3 8.3Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.6" y="4" width="14.8" height="9.6" rx="1.6" />
      <path d="M7 16.6h6" />
    </svg>
  );
}

/** Cycles system → light → dark. Defaults to following the operating system. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);
  const upcoming = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => apply(upcoming)}
      className="flex h-9 w-9 items-center justify-center rounded-full text-graphite transition-colors hover:bg-page-bg hover:text-ink"
      title={`Theme: ${LABEL[theme]}`}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[upcoming].toLowerCase()}.`}
    >
      <Icon theme={theme} />
    </button>
  );
}

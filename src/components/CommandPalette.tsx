"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/app/api/search/route";

type Page = { label: string; path: string };
type Item = { key: string; group: string; title: string; detail?: string; mono?: string; href: string };

export const OPEN_SEARCH_EVENT = "vendra:open-search";

/** Opens the palette from anywhere (the header button dispatches this). */
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

/**
 * Ctrl/Cmd+K: jump to any page, request or order you can see. Pages filter
 * instantly on the client; requests and orders come from /api/search, which
 * applies the same visibility rules as the pages themselves.
 */
export function CommandPalette({ pages, canCreate }: { pages: Page[]; canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const listId = useId();

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    setQuery("");
    setRemote([]);
    setActive(0);
    returnFocus.current?.focus?.();
  }, []);

  // Keyboard shortcut + header button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) hide();
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, [open, show, hide]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced server search; stale responses are aborted.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = (await res.json()) as { results?: SearchResult[] };
        setRemote(data.results ?? []);
      } catch {
        // Aborted or offline: keep what's on screen.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pageItems: Item[] = [
      ...(canCreate ? [{ label: "New purchase request", path: "/purchase-requests/new" }] : []),
      ...pages,
    ]
      .filter((p) => !q || p.label.toLowerCase().includes(q))
      .slice(0, q ? 4 : 8)
      .map((p) => ({ key: `page:${p.path}`, group: "Go to", title: p.label, href: p.path }));
    const live = q.length >= 2 ? remote : [];
    return [
      ...pageItems,
      ...live
        .filter((r) => r.kind === "request")
        .map((r) => ({ key: `pr:${r.id}`, group: "Requests", title: r.title, detail: r.meta, mono: r.number, href: r.href })),
      ...live
        .filter((r) => r.kind === "order")
        .map((r) => ({ key: `po:${r.id}`, group: "Purchase orders", title: r.title, detail: r.meta, mono: r.number, href: r.href })),
    ];
  }, [query, remote, pages, canCreate]);

  const safeActive = Math.min(active, Math.max(0, items.length - 1));

  function go(item: Item | undefined) {
    if (!item) return;
    hide();
    router.push(item.href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[10vh] sm:pt-[14vh]" role="presentation">
      <div className="absolute inset-0 bg-ink/40 animate-fade-in" onClick={hide} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-xl overflow-hidden rounded-lg border border-line bg-surface shadow-overlay animate-fade-in"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="shrink-0 text-graphite" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M12.7 12.7L17 17" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              if (e.target.value.trim().length < 2) setRemote([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(items[safeActive]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                hide();
              } else if (e.key === "Tab") {
                // Focus stays in the dialog; Tab moves through results instead.
                e.preventDefault();
                setActive((i) => (e.shiftKey ? Math.max(i - 1, 0) : Math.min(i + 1, items.length - 1)));
              }
            }}
            role="combobox"
            aria-label="Search"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[safeActive] ? `${listId}-${safeActive}` : undefined}
            aria-autocomplete="list"
            placeholder="Search requests, orders or pages"
            className="h-12 w-full bg-transparent text-[15px] text-ink placeholder:text-graphite/80 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-graphite/50 border-r-transparent" aria-hidden="true" />}
          <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 font-sans text-[11px] text-graphite sm:inline">Esc</kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto py-2">
          {items.map((item, i) => {
            const header = i === 0 || items[i - 1].group !== item.group ? item.group : null;
            return (
              <li key={item.key} role="presentation">
                {header && <div className="px-4 pb-1 pt-2 text-xs font-medium text-graphite">{header}</div>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === safeActive}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                  className={`mx-2 flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 sm:flex-row sm:items-center sm:gap-3 ${i === safeActive ? "bg-accent/[0.08]" : ""}`}
                >
                  {item.mono && <span className="shrink-0 font-mono text-xs text-accent sm:w-[8.5rem] sm:truncate">{item.mono}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{item.title}</span>
                    {item.detail && <span className="block truncate text-xs text-graphite">{item.detail}</span>}
                  </span>
                </div>
              </li>
            );
          })}
          {query.trim().length >= 2 && !loading && items.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-graphite">
              Nothing matches &ldquo;{query.trim()}&rdquo;. Try a PR or PO number, an item, or a person&apos;s name.
            </li>
          )}
        </ul>
        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-graphite sm:flex">
          <span>
            <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to move
          </span>
          <span>
            <kbd className="font-sans">Enter</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}

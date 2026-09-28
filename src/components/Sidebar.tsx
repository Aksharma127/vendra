"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuNode } from "@/lib/auth-context";
import { useMobileNav } from "./MobileNavContext";

// Small inline icon set, matched by label. Not database-driven (icons aren't
// part of the menu schema) - a cosmetic detail, not a functional one.
function GroupIcon({ label }: { label: string }) {
  const common = "w-4 h-4 shrink-0";
  switch (label) {
    case "Procurement":
      return (
        <svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 6h14l-1.5 9a1.5 1.5 0 0 1-1.5 1.3H6a1.5 1.5 0 0 1-1.5-1.3L3 6Z" strokeLinejoin="round" />
          <path d="M6.5 6V4.5a3.5 3.5 0 0 1 7 0V6" strokeLinecap="round" />
        </svg>
      );
    case "Insights":
      return (
        <svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 17V9m5.5 8V4.5M14 17v-5m5.5 5V7" strokeLinecap="round" />
        </svg>
      );
    case "Administration":
      return (
        <svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="2.4" />
          <path d="M10 2.5v2m0 11v2M17.5 10h-2m-11 0h-2m11.5-5.7-1.4 1.4M6 14.3l-1.4 1.4m0-11.4L6 5.7m8 8.6 1.4 1.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
        </svg>
      );
  }
}

function isActive(pathname: string, path: string | null) {
  if (!path) return false;
  return pathname === path || pathname.startsWith(path + "/");
}

export function Sidebar({ tree, buildId }: { tree: MenuNode[]; buildId?: string }) {
  const pathname = usePathname();
  const { open, close } = useMobileNav();

  return (
    <>
      {/* Backdrop, mobile only, only while the drawer is open */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden animate-fade-in"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        // The off-canvas drawer relies on this transform being applied on
        // narrow screens. Tailwind v4's translate-x-* utilities emit the
        // standalone CSS `translate` property (not `transform`) - that
        // property is only ~2022+ in Chrome, and older/OEM Android WebViews
        // (common on budget and China-market phones) silently ignore it,
        // leaving the sidebar fully visible and shoving the content over
        // instead of hiding off-screen. `transform: translateX()` has been
        // supported everywhere for over a decade, so it's used explicitly
        // here via an arbitrary-value utility instead of trusting the
        // shorthand.
        className={`w-60 shrink-0 border-r border-line bg-surface flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out lg:static lg:[transform:translateX(0)] ${
          open ? "[transform:translateX(0)]" : "[transform:translateX(-100%)]"
        }`}
      >
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-white text-xs font-semibold transition-transform duration-200 hover:scale-105">
            V
          </div>
          <span className="text-base font-semibold text-ink tracking-tight">Vendra</span>
        </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {tree.map((node) =>
          node.path ? (
            <Link
              key={node.id}
              href={node.path}
              className={`relative flex items-center gap-2.5 mx-2 mb-0.5 px-3 py-2 text-sm rounded transition-all duration-150 ${
                isActive(pathname, node.path)
                  ? "bg-accent text-white"
                  : "text-ink hover:bg-page-bg hover:pl-3.5"
              }`}
            >
              {isActive(pathname, node.path) && (
                <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-accent" />
              )}
              <GroupIcon label={node.label} />
              {node.label}
            </Link>
          ) : (
            <div key={node.id} className="mb-4 mt-2">
              <div className="px-5 mb-1 flex items-center gap-2 text-xs font-medium text-graphite uppercase tracking-wide">
                <GroupIcon label={node.label} />
                {node.label}
              </div>
              {node.children.map((child) => (
                <Link
                  key={child.id}
                  href={child.path ?? "#"}
                  className={`relative block mx-2 mb-0.5 px-3 py-2 pl-9 text-sm rounded transition-all duration-150 ${
                    isActive(pathname, child.path)
                      ? "bg-accent text-white"
                      : "text-ink hover:bg-page-bg hover:pl-10"
                  }`}
                >
                  {isActive(pathname, child.path) && (
                    <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-accent" />
                  )}
                  {child.label}
                </Link>
              ))}
            </div>
          )
        )}
        {tree.length === 0 && (
          <div className="px-5 py-3 text-sm text-graphite">No menu items available.</div>
        )}
      </nav>
        <div className="px-5 py-3 border-t border-line flex items-center gap-2 text-[11px] text-graphite/70">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Vendra Console
          {buildId && <span className="ml-auto font-mono">{buildId}</span>}
        </div>
      </aside>
    </>
  );
}

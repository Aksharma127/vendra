"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { MenuNode } from "@/lib/auth-context";
import { useMobileNav } from "./MobileNavContext";

// Icons matched by path. Cosmetic, not part of the menu schema, so a menu
// item an admin adds later simply gets the neutral square.
const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": <path d="M3.5 3.5h5.5v5.5H3.5zM11 3.5h5.5v5.5H11zM3.5 11h5.5v5.5H3.5zM11 11h5.5v5.5H11z" />,
  "/purchase-requests/mine": (
    <>
      <path d="M5.5 2.5h6l3.5 3.5v11.5h-9.5z" />
      <path d="M11.5 2.5V6H15M8 10h5M8 13h5" />
    </>
  ),
  "/purchase-requests/queue": (
    <>
      <path d="M2.5 11.5l2.2-7h10.6l2.2 7v5h-15z" />
      <path d="M2.5 11.5h4.2a3.3 3.3 0 0 0 6.6 0h4.2" />
    </>
  ),
  "/purchase-requests/all": <path d="M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01" />,
  "/purchase-orders": (
    <>
      <path d="M4.5 2.5h11v15l-2.2-1.4-2.1 1.4-2.2-1.4-2.2 1.4-2.3-1.4z" />
      <path d="M7.5 7.5h5M7.5 10.5h5" />
    </>
  ),
  "/vendors": (
    <>
      <path d="M3 8l1.5-4.5h11L17 8" />
      <path d="M3 8h14v1a2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 1-4.7 0A2.3 2.3 0 0 1 3 9z" />
      <path d="M4 11v6h12v-6M8 17v-3.5h4V17" />
    </>
  ),
  "/reports": <path d="M3 17V9m5 8V4m5 13v-6m4 6V7" />,
  "/audit-trail": (
    <>
      <path d="M3.3 10a6.7 6.7 0 1 0 2-4.8L3 7.5" />
      <path d="M3 3.5v4h4M10 6.5V10l2.5 1.5" />
    </>
  ),
  "/admin/companies": (
    <>
      <path d="M3.5 17V4.5h8V17M11.5 8.5h5V17M2 17h16" />
      <path d="M6 7.5h3M6 10.5h3M6 13.5h3M14 11.5v.01M14 14.5v.01" />
    </>
  ),
  "/admin/divisions": (
    <>
      <path d="M7.5 2.5h5v4h-5zM2.5 13.5h5v4h-5zM12.5 13.5h5v4h-5z" />
      <path d="M10 6.5v3.5M5 13.5V10h10v3.5" />
    </>
  ),
  "/admin/users": (
    <>
      <circle cx="7.5" cy="6.5" r="3" />
      <path d="M2 17a5.5 5.5 0 0 1 11 0M13.5 3.8a3 3 0 0 1 0 5.4M15.5 12.2A5.5 5.5 0 0 1 18 17" />
    </>
  ),
  "/admin/roles": (
    <>
      <circle cx="6.5" cy="13.5" r="3.5" />
      <path d="M9 11l7.5-7.5M13.5 6.5l2 2M11.5 8.5l1.5 1.5" />
    </>
  ),
  "/admin/config": <path d="M4 5h4m4 0h4M4 10h8m4 0h0M4 15h2m4 0h6M10 3.5v3M14 8.5v3M8 13.5v3" />,
};

function ItemIcon({ path }: { path: string | null }) {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(path && ICONS[path]) ?? <rect x="3.5" y="3.5" width="13" height="13" rx="2" />}
    </svg>
  );
}

// Must render inside a <Link>: a small spinner on the item that was tapped
// until its page commits. Always mounted, only opacity toggles, so it never
// shifts the label.
function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 rounded-full border-[1.5px] border-current border-r-transparent animate-spin transition-opacity duration-150 ${
        pending ? "opacity-70" : "opacity-0"
      }`}
    />
  );
}

function isActive(pathname: string, path: string | null) {
  if (!path) return false;
  return pathname === path || pathname.startsWith(path + "/");
}

function NavItem({ node, pathname, onClick, badge }: { node: MenuNode; pathname: string; onClick: () => void; badge?: number }) {
  const active = isActive(pathname, node.path);
  return (
    <Link
      href={node.path ?? "#"}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative mx-2 mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
        active ? "bg-accent/[0.08] font-medium text-accent" : "text-ink/85 hover:bg-page-bg hover:text-ink"
      }`}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" />}
      <ItemIcon path={node.path} />
      <span className="flex-1 truncate">{node.label}</span>
      {badge ? (
        <span className="min-w-[20px] rounded-full bg-accent px-1.5 text-center text-[11px] font-medium leading-5 text-on-accent tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      <PendingHint />
    </Link>
  );
}

export function Sidebar({ tree, buildId, badges = {} }: { tree: MenuNode[]; buildId?: string; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const { open, close } = useMobileNav();

  return (
    <>
      {/* Backdrop, mobile only, only while the drawer is open */}
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden animate-fade-in" onClick={close} aria-hidden="true" />}
      <aside
        // The off-canvas drawer relies on this transform on narrow screens.
        // Tailwind v4's translate-x-* utilities emit the standalone CSS
        // `translate` property, which older/OEM Android WebViews ignore, so
        // `transform: translateX()` is used explicitly. On desktop it's a
        // sticky full-height column, so the menu stays in view on long pages.
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-line bg-surface transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:[transform:translateX(0)] ${
          open ? "[transform:translateX(0)]" : "[transform:translateX(-100%)]"
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-semibold text-on-accent">V</div>
          <span className="text-base font-semibold tracking-tight text-ink">Vendra</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Main">
          {tree.map((node) =>
            node.path ? (
              <NavItem key={node.id} node={node} pathname={pathname} onClick={close} badge={badges[node.path]} />
            ) : (
              <div key={node.id} className="mt-4 mb-1">
                <div className="mb-1 px-5 text-xs font-medium text-graphite">{node.label}</div>
                {node.children.map((child) => (
                  <NavItem key={child.id} node={child} pathname={pathname} onClick={close} badge={child.path ? badges[child.path] : undefined} />
                ))}
              </div>
            )
          )}
          {tree.length === 0 && <div className="px-5 py-3 text-sm text-graphite">No menu items available.</div>}
        </nav>
        {buildId && (
          // Which commit is live - handy for checking a deploy from a phone.
          <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[11px] text-graphite/80">
            Version
            <span className="ml-auto font-mono">{buildId}</span>
          </div>
        )}
      </aside>
    </>
  );
}

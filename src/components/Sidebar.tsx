import Link from "next/link";
import type { AuthContext } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  show: (ctx: AuthContext) => boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// Rendered purely from ctx.capabilities - no component in this file checks a
// role name directly. This is the concrete "dynamic menu" implementation:
// a section with zero visible items is simply not rendered.
const SECTIONS: NavSection[] = [
  {
    label: "",
    items: [{ href: "/dashboard", label: "Dashboard", show: () => true }],
  },
  {
    label: "Procurement",
    items: [
      { href: "/purchase-requests/mine", label: "My Requests", show: (c) => c.capabilities.has("pr:create") },
      {
        href: "/purchase-requests/queue",
        label: "Approval Queue",
        show: (c) => c.capabilities.has("pr:approve-division") || c.capabilities.has("pr:approve-finance"),
      },
      { href: "/purchase-requests/all", label: "All Requests", show: (c) => c.capabilities.has("pr:view-all") },
      { href: "/purchase-orders", label: "Purchase Orders", show: (c) => c.capabilities.has("po:issue") || c.capabilities.has("pr:view-all") },
      { href: "/vendors", label: "Vendors", show: (c) => c.capabilities.has("vendor:manage") },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", show: (c) => c.capabilities.has("reports:view") },
      { href: "/audit-trail", label: "Audit Trail", show: (c) => c.capabilities.has("audit:view") },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/companies", label: "Companies", show: (c) => c.capabilities.has("admin:manage") },
      { href: "/admin/divisions", label: "Divisions", show: (c) => c.capabilities.has("admin:manage") },
      { href: "/admin/users", label: "Users", show: (c) => c.capabilities.has("admin:manage") },
    ],
  },
];

export function Sidebar({ ctx }: { ctx: AuthContext }) {
  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.show(ctx)),
  })).filter((s) => s.items.length > 0);

  return (
    <aside className="w-60 shrink-0 border-r border-line bg-surface flex flex-col">
      <div className="px-5 py-4 border-b border-line">
        <span className="text-base font-semibold text-ink">Vendra</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {visibleSections.map((section, idx) => (
          <div key={idx} className="mb-4">
            {section.label && (
              <div className="px-5 mb-1 text-xs text-graphite">{section.label}</div>
            )}
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-5 py-2 text-sm text-ink hover:bg-page-bg transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

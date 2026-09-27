import Link from "next/link";
import type { AuthContext } from "@/lib/auth-context";
import { CompanySwitcher } from "./CompanySwitcher";
import { SignOutButton } from "./SignOutButton";

export function Header({
  ctx,
  pendingApprovalCount = 0,
}: {
  ctx: AuthContext;
  pendingApprovalCount?: number;
}) {
  return (
    <header className="h-14 border-b border-line bg-surface flex items-center justify-between px-5 shrink-0 shadow-[0_1px_3px_rgba(21,24,33,0.05)] relative z-10">
      <CompanySwitcher companies={ctx.authorizedCompanies} activeCompanyId={ctx.activeCompanyId} />
      <div className="flex items-center gap-4">
        <Link
          href="/purchase-requests/queue"
          className="relative flex items-center justify-center h-8 w-8 rounded-full text-graphite hover:text-ink hover:bg-page-bg transition-all duration-150 hover:scale-105 active:scale-95"
          title={
            pendingApprovalCount > 0
              ? `${pendingApprovalCount} request${pendingApprovalCount === 1 ? "" : "s"} awaiting your approval`
              : "No pending approvals"
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {pendingApprovalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] leading-4 text-center font-medium animate-soft-pulse">
              {pendingApprovalCount > 99 ? "99+" : pendingApprovalCount}
            </span>
          )}
        </Link>
        <div className="text-sm text-right">
          <div className="text-ink">{ctx.userName}</div>
          <div className="text-xs text-graphite">{ctx.roleNames.join(", ") || "No role assigned"}</div>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}

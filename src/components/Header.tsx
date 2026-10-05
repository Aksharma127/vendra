import Link from "next/link";
import type { AuthContext } from "@/lib/auth-context";
import { CompanySwitcher } from "./CompanySwitcher";
import { SignOutButton } from "./SignOutButton";
import { MobileNavToggle } from "./MobileNavToggle";
import { SearchButton } from "./SearchButton";
import { UserAvatar } from "./UserAvatar";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ ctx, pendingApprovalCount = 0 }: { ctx: AuthContext; pendingApprovalCount?: number }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur-md sm:gap-3 sm:px-5">
      <MobileNavToggle />
      <CompanySwitcher companies={ctx.authorizedCompanies} activeCompanyId={ctx.activeCompanyId} />
      {ctx.hasBusinessRole && (
        <div className="flex flex-1 justify-end md:justify-center">
          <SearchButton />
        </div>
      )}
      <div className={`flex shrink-0 items-center gap-1.5 sm:gap-3 ${ctx.hasBusinessRole ? "" : "ml-auto"}`}>
        {ctx.hasBusinessRole && (
          <Link
            href="/purchase-requests/queue"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-graphite transition-colors hover:bg-page-bg hover:text-ink"
            aria-label={
              pendingApprovalCount > 0
                ? `${pendingApprovalCount} request${pendingApprovalCount === 1 ? "" : "s"} waiting on you`
                : "Approval queue, nothing waiting on you"
            }
            title={pendingApprovalCount > 0 ? `${pendingApprovalCount} waiting on you` : "Nothing waiting on you"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {pendingApprovalCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-4 min-w-[16px] rounded-full bg-danger px-1 text-center text-[10px] font-medium leading-4 text-on-accent tabular-nums ring-2 ring-surface">
                {pendingApprovalCount > 99 ? "99+" : pendingApprovalCount}
              </span>
            )}
          </Link>
        )}
        <ThemeToggle />
        <div className="hidden items-center gap-2.5 sm:flex">
          <UserAvatar name={ctx.userName} size="md" />
          <div className="max-w-[10rem] text-sm leading-tight">
            <div className="truncate text-ink">{ctx.userName}</div>
            <div className="truncate text-xs text-graphite">{ctx.roleNames.join(", ") || "No role assigned"}</div>
          </div>
        </div>
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        <SignOutButton />
      </div>
    </header>
  );
}

import type { AuthContext } from "@/lib/auth-context";
import { CompanySwitcher } from "./CompanySwitcher";
import { logoutAction } from "@/lib/actions/auth";

export function Header({ ctx }: { ctx: AuthContext }) {
  return (
    <header className="h-14 border-b border-line bg-surface flex items-center justify-between px-5 shrink-0">
      <CompanySwitcher companies={ctx.authorizedCompanies} activeCompanyId={ctx.activeCompanyId} />
      <div className="flex items-center gap-4">
        <div className="text-sm text-right">
          <div className="text-ink">{ctx.userName}</div>
          <div className="text-xs text-graphite">{ctx.roleNames.join(", ") || "No role assigned"}</div>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-graphite hover:text-ink transition-colors">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchCompanyAction } from "@/lib/actions/auth";

export function CompanySwitcher({
  companies,
  activeCompanyId,
}: {
  companies: { id: string; name: string }[];
  activeCompanyId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (companies.length <= 1) {
    return <span className="text-sm text-graphite">{companies[0]?.name ?? "No company"}</span>;
  }

  return (
    <select
      className="text-sm border border-line rounded px-2 py-1.5 bg-surface disabled:opacity-50"
      value={activeCompanyId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const companyId = e.target.value;
        startTransition(async () => {
          await switchCompanyAction(companyId);
          router.refresh();
        });
      }}
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

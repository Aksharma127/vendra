"use client";

import { useActionState } from "react";
import { updateConfigAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

export function ConfigRow({
  configId,
  configKey,
  companyLabel,
  value,
  readOnly,
}: {
  configId: string;
  configKey: string;
  companyLabel: string;
  value: string;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateConfigAction, undefined);

  return (
    <tr className="border-b border-line last:border-0 align-top">
      <td className="py-2.5 pr-4 text-ink font-mono text-xs">{configKey}</td>
      <td className="py-2.5 pr-4 text-graphite">{companyLabel}</td>
      <td className="py-2.5 pr-4">
        {readOnly ? (
          <span className="text-ink">{value}</span>
        ) : (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="configId" value={configId} />
            <input
              name="value"
              defaultValue={value}
              className="text-sm border border-line rounded px-2 py-1 bg-surface text-ink w-32 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button type="submit" variant="secondary" disabled={pending} className="!px-2 !py-1 text-xs">
              {pending ? "..." : "Save"}
            </Button>
            {state?.error && <span className="text-xs text-danger">{state.error}</span>}
            {state?.success && <span className="text-xs text-success">Saved</span>}
          </form>
        )}
      </td>
    </tr>
  );
}

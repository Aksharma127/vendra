"use client";

import { useActionState } from "react";
import { createUserAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "block text-xs text-graphite mb-1";

export function CreateUserForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Full name</label>
          <input name="name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input name="email" type="email" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Temporary password</label>
          <input name="password" type="text" required minLength={6} className={inputClass} placeholder="min 6 characters" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Company access</label>
        <div className="flex flex-wrap gap-4">
          {companies.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" name="companyIds" value={c.id} className="accent-accent" />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">User created. Assign a role below.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create User"}
      </Button>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/actions/auth";

// Deliberately NOT a <form action={logoutAction}> - see next.config.ts /
// purchase-requests-create.ts for the full writeup. A server-rendered
// <form action={...}> in the shared layout (this button, present on every
// page) was colliding with a client-rendered useActionState-bound
// <form action={formAction}> anywhere else on the same page: submitting the
// OTHER form silently invoked this sign-out action instead of its own,
// logging the user out. Every "Create X" admin form and the New Purchase
// Request form hit this. Dispatching logout as a plain transitioned call -
// the same pattern already used successfully for submitPRAction and
// switchCompanyAction - avoids the collision instead of chasing it in every
// affected form.
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await logoutAction();
        });
      }}
      className="text-sm text-graphite hover:text-ink transition-colors disabled:opacity-50"
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}

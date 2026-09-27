"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleUserActiveAction, revokeRoleAction } from "@/lib/actions/admin";

export function UserToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleUserActiveAction(userId, !isActive);
          router.refresh();
        })
      }
      className="text-xs text-accent hover:underline disabled:opacity-50"
    >
      {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}

export function RevokeRoleButton({ userRoleId }: { userRoleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await revokeRoleAction(userRoleId);
          router.refresh();
        })
      }
      className="text-xs text-danger hover:underline disabled:opacity-50"
    >
      Revoke
    </button>
  );
}

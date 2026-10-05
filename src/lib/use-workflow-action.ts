"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";

type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * Runs an in-place workflow action (approve, reject, mark delivered, ...).
 * Success: confirmation toast + refresh the page's server data.
 * Failure: the server's own message, shown next to the buttons.
 */
export function useWorkflowAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<Result>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      let result: Result;
      try {
        result = await action();
      } catch {
        // Only reachable if the request itself failed (offline, timeout).
        result = { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(result.message);
      onSuccess?.();
      router.refresh();
    });
  }

  return { run, pending, error, setError };
}

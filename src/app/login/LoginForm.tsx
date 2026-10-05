"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { UserAvatar } from "@/components/UserAvatar";

export type DemoAccount = { email: string; name: string; role: string; does: string };

const inputClass =
  "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink transition-shadow placeholder:text-graphite/70 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent aria-[invalid=true]:border-danger/60";

export function LoginForm({ demoAccounts, demoPassword }: { demoAccounts: DemoAccount[]; demoPassword: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  // Controlled, so a failed sign-in doesn't wipe what was typed (React resets
  // uncontrolled fields after a form action - the email used to vanish).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingInAs, setSigningInAs] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorId = "login-error";

  // After a failed attempt: keep the email (from the server's answer, in case
  // the browser autofilled it), clear the password and put the cursor there.
  // State is adjusted during render when a new result arrives (React's
  // recommended alternative to setState inside an effect); focusing is a DOM
  // side effect, so that part stays in an effect.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.error) {
      setSigningInAs(null);
      if (state.email) setEmail(state.email);
      setPassword("");
    }
  }
  useEffect(() => {
    if (state?.error) passwordRef.current?.focus();
  }, [state]);

  function signInAs(acct: DemoAccount) {
    setEmail(acct.email);
    setPassword(demoPassword);
    setSigningInAs(acct.email);
    const fd = new FormData();
    fd.set("email", acct.email);
    fd.set("password", demoPassword);
    startTransition(() => formAction(fd));
  }

  const invalid = Boolean(state?.error);

  return (
    <>
      <div className="bg-surface/85 backdrop-blur-md border border-line rounded-lg p-6 shadow-raised panel-interactive">
        <form action={formAction} onSubmit={() => setSigningInAs(null)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-graphite mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              className={inputClass}
              placeholder="priya@vendra.demo"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-graphite mb-1">
              Password
            </label>
            <PasswordInput
              ref={passwordRef}
              id="password"
              name="password"
              required
              autoComplete="current-password"
              enterKeyHint="go"
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              inputClassName={inputClass}
              placeholder="••••••••"
            />
          </div>
          <div aria-live="assertive" aria-atomic="true">
            {state?.error && (
              <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="mt-0.5 shrink-0" aria-hidden="true">
                  <path d="M10 1.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4Zm-.9 4.4h1.8v5.2H9.1V6.2Zm0 6.7h1.8v1.8H9.1v-1.8Z" />
                </svg>
                {state.error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending && !signingInAs ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/80 border-r-transparent animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-surface/70 backdrop-blur-md p-4">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <p className="text-xs font-medium text-ink">Try a demo account</p>
          <p className="text-[11px] text-graphite">
            password <span className="font-mono text-ink">{demoPassword}</span>
          </p>
        </div>
        <ul className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
          {demoAccounts.map((acct, i) => {
            const busy = pending && signingInAs === acct.email;
            // An odd one out at the end spans the full width instead of leaving a gap.
            const lastOdd = i === demoAccounts.length - 1 && demoAccounts.length % 2 === 1;
            return (
              <li key={acct.email} className={lastOdd ? "min-[360px]:col-span-2" : ""}>
                <button
                  type="button"
                  onClick={() => signInAs(acct)}
                  disabled={pending}
                  aria-label={`Sign in as ${acct.name}, ${acct.role}`}
                  title={acct.email}
                  className="group flex w-full items-center gap-2.5 rounded-md border border-line bg-surface/80 px-2.5 py-2 text-left transition-colors hover:border-accent/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                      <span className="h-4 w-4 rounded-full border-2 border-accent border-r-transparent animate-spin" aria-hidden="true" />
                    </span>
                  ) : (
                    <UserAvatar name={acct.name} size="sm" className="shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-ink">{busy ? "Signing in…" : acct.role}</span>
                    <span className="block truncate text-[11px] text-graphite">{acct.does}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

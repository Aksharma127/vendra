"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { createUserAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";
import { PasswordInput, generatePassword } from "@/components/ui/PasswordInput";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "block text-xs text-graphite mb-1";
const MIN_LENGTH = 6;

export function CreateUserForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, undefined);
  // Every field is controlled: React resets a form after its action runs, so
  // uncontrolled fields would be wiped even when the create FAILS (e.g. the
  // email is taken) and the admin would have to type it all again. They're
  // cleared here only on success.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.success) {
      setName("");
      setEmail("");
      setCompanyIds([]);
      setPassword("");
      setVisible(false);
      setCopied(false);
    }
  }

  function generate() {
    setPassword(generatePassword());
    // Show it: the admin has to pass it on, so they need to read it.
    setVisible(true);
    setCopied(false);
    passwordRef.current?.focus();
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // Clipboard API needs a secure context and permission; fall back to
      // selecting the text so Ctrl/Cmd+C works.
      setVisible(true);
      passwordRef.current?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  return (
    // autoComplete="off" + "new-password" below stop the browser treating this
    // as a login form and autofilling the admin's OWN saved email/password.
    <form
      // Submitted by hand instead of action={formAction}: with the `action`
      // prop React resets the form afterwards, and that reset un-ticks the
      // company checkboxes in the page while state still says they're ticked,
      // so the next submit would silently drop company access. Every field
      // here is controlled, so nothing needs React's reset.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      autoComplete="off"
      className="space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="new-user-name" className={labelClass}>
            Full name
          </label>
          <input
            id="new-user-name"
            name="name"
            required
            maxLength={200}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="new-user-email" className={labelClass}>
            Email
          </label>
          <input
            id="new-user-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <label htmlFor="new-user-password" className="text-xs text-graphite">
              Temporary password
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" onClick={generate} className="text-accent hover:underline focus-visible:outline-none focus-visible:underline">
                Generate
              </button>
              {password && (
                <button
                  type="button"
                  onClick={copy}
                  className="text-accent hover:underline focus-visible:outline-none focus-visible:underline"
                  aria-live="polite"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
          <PasswordInput
            ref={passwordRef}
            id="new-user-password"
            name="password"
            required
            minLength={MIN_LENGTH}
            maxLength={256}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setCopied(false);
            }}
            visible={visible}
            onVisibleChange={setVisible}
            aria-invalid={tooShort}
            aria-describedby="new-user-password-help"
            inputClassName={`${inputClass} ${visible ? "font-mono tracking-wide" : ""}`}
            placeholder={`min ${MIN_LENGTH} characters`}
          />
          <p id="new-user-password-help" className={`mt-1 text-[11px] ${tooShort ? "text-danger" : "text-graphite"}`}>
            {tooShort ? `${MIN_LENGTH - password.length} more character${MIN_LENGTH - password.length === 1 ? "" : "s"} needed` : "Share it with the user privately."}
          </p>
        </div>
      </div>
      <div>
        <span className={labelClass}>Company access</span>
        <div className="flex flex-wrap gap-4">
          {companies.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                name="companyIds"
                value={c.id}
                checked={companyIds.includes(c.id)}
                onChange={(e) => setCompanyIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))}
                className="accent-accent"
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-sm text-success">
          User created. Assign a role below.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create User"}
      </Button>
    </form>
  );
}

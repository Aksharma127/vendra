"use client";

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Classes for the <input>. Right padding for the toggle is added for you. */
  inputClassName?: string;
  /** Controlled visibility (optional). Leave unset to let the field manage it. */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  /** Show a "Caps Lock is on" hint while typing. Default true. */
  capsLockHint?: boolean;
};

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.8 10s3-5.8 8.2-5.8 8.2 5.8 8.2 5.8-3 5.8-8.2 5.8S1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
      {off && <path d="M3 3l14 14" />}
    </svg>
  );
}

/**
 * Password field with a show/hide toggle.
 *
 * Details that matter and are easy to get wrong:
 * - The toggle is type="button", so it never submits the form.
 * - Toggling keeps focus and the caret where they were. Tapping it on a phone
 *   doesn't close the keyboard (pointerdown is prevented so the input never
 *   blurs), and the cursor doesn't jump to the start when the type changes.
 * - The field goes back to hidden when its form submits, so the browser's
 *   password manager still sees a password field and offers to save it, and
 *   when the tab is backgrounded, so it isn't left on screen.
 * - Screen readers get a real toggle: aria-pressed plus a label that says
 *   what pressing it will do, linked to the input with aria-controls.
 * - Edge's own reveal eye is hidden in globals.css so there aren't two.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { inputClassName = "", visible: visibleProp, onVisibleChange, capsLockHint = true, id, className = "", onKeyDown, onKeyUp, onBlur, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? `pw-${autoId}`;
  const hintId = `${inputId}-caps`;
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const [visibleState, setVisibleState] = useState(false);
  const visible = visibleProp ?? visibleState;
  const setVisible = useCallback(
    (v: boolean) => {
      if (visibleProp === undefined) setVisibleState(v);
      onVisibleChange?.(v);
    },
    [visibleProp, onVisibleChange]
  );

  const [capsOn, setCapsOn] = useState(false);
  // Caret to restore after the type flip re-renders the input.
  const pendingSelection = useRef<[number | null, number | null] | null>(null);

  useEffect(() => {
    const sel = pendingSelection.current;
    const el = inputRef.current;
    if (!sel || !el) return;
    pendingSelection.current = null;
    const restore = () => {
      try {
        if (document.activeElement === el) el.setSelectionRange(sel[0], sel[1]);
      } catch {
        // Some input types don't support selection; nothing to restore.
      }
    };
    restore();
    // Chrome rebuilds the field's inner editor when `type` changes and puts
    // the caret back at 0 on the next layout - after this effect has run. So
    // restore once more on the next frame.
    const raf = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // Re-hide on submit and when the page is hidden.
  useEffect(() => {
    const form = inputRef.current?.form;
    const hide = () => setVisible(false);
    const onVis = () => document.visibilityState === "hidden" && hide();
    form?.addEventListener("submit", hide);
    form?.addEventListener("reset", hide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      form?.removeEventListener("submit", hide);
      form?.removeEventListener("reset", hide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [setVisible]);

  function toggle() {
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      pendingSelection.current = [el.selectionStart, el.selectionEnd];
    }
    setVisible(!visible);
  }

  const readCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // getModifierState is missing on some virtual keyboards; treat as "off".
    if (capsLockHint && typeof e.getModifierState === "function") setCapsOn(e.getModifierState("CapsLock"));
  };

  return (
    <div className={className}>
      <div className="relative">
        <input
          {...rest}
          ref={inputRef}
          id={inputId}
          type={visible ? "text" : "password"}
          // Visible passwords shouldn't be spell-checked (Chrome would send the
          // text to its enhanced spellcheck service) or auto-corrected.
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-describedby={[rest["aria-describedby"], capsOn ? hintId : null].filter(Boolean).join(" ") || undefined}
          className={`${inputClassName} pr-11`}
          onKeyDown={(e) => {
            readCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            readCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsOn(false);
            onBlur?.(e);
          }}
        />
        <button
          type="button"
          onClick={toggle}
          // Keep focus (and the phone keyboard) on the input.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          aria-controls={inputId}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          disabled={rest.disabled}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r text-graphite transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 disabled:opacity-40"
        >
          <EyeIcon off={visible} />
        </button>
      </div>
      {capsOn && (
        <p id={hintId} role="status" className="mt-1.5 flex items-center gap-1 text-xs text-warning">
          <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor" aria-hidden="true">
            <path d="M10 2.5 2.5 10h4v4.5h7V10h4L10 2.5Zm-3.5 14h7V18h-7v-1.5Z" />
          </svg>
          Caps Lock is on
        </p>
      )}
    </div>
  );
});

const UNAMBIGUOUS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * Random temporary password from the browser's CSPRNG, without look-alike
 * characters (0/O, 1/l/I) so it can be read out or typed from a screenshot.
 * Rejection sampling keeps every character equally likely.
 */
export function generatePassword(length = 14) {
  const out: string[] = [];
  const buf = new Uint8Array(length * 2);
  const limit = 256 - (256 % UNAMBIGUOUS.length);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit && out.length < length) out.push(UNAMBIGUOUS[b % UNAMBIGUOUS.length]);
    }
  }
  return out.join("");
}

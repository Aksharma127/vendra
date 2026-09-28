"use client";

import { useActionState, useRef, useState } from "react";
import { createDraftAction } from "@/lib/actions/purchase-requests-create";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-500";
const labelClass = "block text-xs text-graphite mb-1";
// Fields the AI filled get a soft tint until the user edits them, so it's
// obvious what to double-check.
const aiFilled = "!bg-[#eef3f9] !border-accent/60";

type Fields = {
  divisionId: string;
  category: string;
  itemDescription: string;
  quantity: string;
  estimatedUnitCost: string;
  justification: string;
};

type Suggestion = {
  divisionId: string | null;
  category: string;
  itemDescription: string;
  quantity: number | null;
  estimatedUnitCost: number | null;
  justification: string;
  confidence: "high" | "medium" | "low";
  notes: string[];
};

const formatINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function AIAssist({ onFill }: { onFill: (s: Suggestion) => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function run() {
    if (!text.trim() && !file) {
      setError("Type what you need, or attach a quote.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("text", text);
      if (file) body.set("file", file);
      const res = await fetch("/api/ai/draft", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "AI autofill failed.");
      onFill(data.suggestion as Suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI autofill failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-accent/25 bg-accent/[0.03] p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-accent" fill="currentColor" aria-hidden="true">
          <path d="M10 1.5l1.6 4.3 4.4 1.7-4.4 1.7L10 13.5l-1.6-4.3L4 7.5l4.4-1.7L10 1.5Zm5.5 10 .8 2.1 2.2.9-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.9.8-2.1Z" />
        </svg>
        <span className="text-sm font-medium text-ink">Fill with AI</span>
      </div>
      <p className="text-xs text-graphite mb-3">
        Describe what you need, paste a supplier&apos;s email, or attach a photo/PDF of a quote. The form below gets filled in - nothing is saved until you check it and press Save.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={6000}
        className={inputClass}
        placeholder="e.g. Need 40 pairs of steel-toe safety shoes for the new night shift, around ₹1,800 a pair"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
        }}
      />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 4 * 1024 * 1024) {
              setError("That file is over 4 MB. Try a smaller photo or a single-page PDF.");
              e.target.value = "";
              return;
            }
            setError(null);
            setFile(f);
          }}
        />
        <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
          {file ? "Change file" : "Attach quote"}
        </Button>
        {file && (
          <span className="inline-flex items-center gap-1.5 text-xs text-graphite max-w-[14rem]">
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              className="text-graphite hover:text-danger"
              aria-label="Remove file"
              onClick={() => {
                setFile(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
            >
              ✕
            </button>
          </span>
        )}
        <Button type="button" onClick={run} disabled={busy} className="ml-auto">
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/80 border-r-transparent animate-spin" aria-hidden="true" />
              Reading...
            </>
          ) : (
            "Fill the form"
          )}
        </Button>
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}

export function NewPRForm({ divisions, aiEnabled = false }: { divisions: { id: string; name: string }[]; aiEnabled?: boolean }) {
  const [state, formAction, pending] = useActionState(createDraftAction, undefined);
  const [fields, setFields] = useState<Fields>({
    divisionId: divisions[0]?.id ?? "",
    category: "",
    itemDescription: "",
    quantity: "",
    estimatedUnitCost: "",
    justification: "",
  });
  const [filled, setFilled] = useState<Set<keyof Fields>>(new Set());
  const [ai, setAi] = useState<{ confidence: Suggestion["confidence"]; notes: string[] } | null>(null);

  if (divisions.length === 0) {
    return (
      <p className="text-sm text-graphite">
        You don&apos;t have access to any division that can raise requests. Contact your administrator.
      </p>
    );
  }

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setFields((f) => ({ ...f, [k]: value }));
    setFilled((s) => {
      if (!s.has(k)) return s;
      const next = new Set(s);
      next.delete(k);
      return next;
    });
  };

  function applySuggestion(s: Suggestion) {
    // A new AI fill replaces every AI-fillable field, so nothing from an
    // earlier fill (e.g. the previous item's justification) lingers. Division
    // only changes when the AI matched one of the user's own divisions.
    const next: Fields = {
      divisionId: s.divisionId && divisions.some((d) => d.id === s.divisionId) ? s.divisionId : fields.divisionId,
      category: s.category ?? "",
      itemDescription: s.itemDescription ?? "",
      quantity: s.quantity != null ? String(s.quantity) : "",
      estimatedUnitCost: s.estimatedUnitCost != null ? String(s.estimatedUnitCost) : "",
      justification: s.justification ?? "",
    };
    setFields(next);
    setFilled(new Set((Object.keys(next) as (keyof Fields)[]).filter((k) => next[k] !== "" && (k !== "divisionId" || next.divisionId !== fields.divisionId))));
    setAi({ confidence: s.confidence, notes: s.notes });
  }

  const cls = (k: keyof Fields) => `${inputClass} ${filled.has(k) ? aiFilled : ""}`;
  const total = Number(fields.quantity) * Number(fields.estimatedUnitCost);

  return (
    <>
      {aiEnabled && <AIAssist onFill={applySuggestion} />}
      <form action={formAction} className="space-y-4">
        <div>
          <label className={labelClass}>Division</label>
          <select name="divisionId" required className={cls("divisionId")} value={fields.divisionId} onChange={set("divisionId")}>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <input name="category" required className={cls("category")} placeholder="e.g. Raw Materials, IT Equipment" value={fields.category} onChange={set("category")} />
        </div>
        <div>
          <label className={labelClass}>Item description</label>
          <textarea name="itemDescription" required rows={3} className={cls("itemDescription")} value={fields.itemDescription} onChange={set("itemDescription")} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Quantity</label>
            <input name="quantity" type="number" min="0.01" step="0.01" required className={cls("quantity")} value={fields.quantity} onChange={set("quantity")} />
          </div>
          <div>
            <label className={labelClass}>Estimated unit cost (₹)</label>
            <input
              name="estimatedUnitCost"
              type="number"
              min="0.01"
              step="0.01"
              required
              className={cls("estimatedUnitCost")}
              value={fields.estimatedUnitCost}
              onChange={set("estimatedUnitCost")}
            />
          </div>
        </div>
        {Number.isFinite(total) && total > 0 && (
          <p className="text-xs text-graphite -mt-2">
            Total: <span className="text-ink font-medium">{formatINR(total)}</span>
          </p>
        )}
        <div>
          <label className={labelClass}>Justification (required above threshold)</label>
          <textarea name="justification" rows={2} className={cls("justification")} value={fields.justification} onChange={set("justification")} />
        </div>

        {ai && (
          <div
            className={`rounded border px-3 py-2.5 text-xs ${
              ai.confidence === "high" ? "border-success/30 bg-success/5" : ai.confidence === "medium" ? "border-warning/30 bg-warning/5" : "border-danger/30 bg-danger/5"
            }`}
          >
            <div className="font-medium text-ink mb-1">
              Filled by AI · {ai.confidence} confidence · highlighted fields need a quick check
            </div>
            {ai.notes.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5 text-graphite">
                {ai.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save as Draft"}
        </Button>
      </form>
    </>
  );
}

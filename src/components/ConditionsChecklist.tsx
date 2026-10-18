interface Condition {
  id: string;
  title: string;
  description?: string | null;
}

/**
 * Conditions of an offer as a numbered, static list (docs/redesign-v2/02-layout-spec.md,
 * offer page 5a). The old in-memory checkboxes are gone on purpose: ticking
 * lives in the real ściąga (PromotionChecklist), which saves progress; a
 * second, throw-away tick list on the offer page only suggested the same.
 * Server-compatible (no state). Same props as before, so callers keep working.
 */
export function ConditionsChecklist({ conditions }: { conditions: Condition[] }) {
  if (conditions.length === 0) return null;

  return (
    // role="list": list-style is reset by the base styles, and Safari/VoiceOver
    // then stops announcing a list unless the role is explicit.
    <ol role="list" className="space-y-5">
      {conditions.map((c, index) => (
        <li key={c.id} className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface font-display text-h4 text-ink-900"
          >
            {index + 1}
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-h4 text-ink-900">{c.title}</p>
            {c.description && <p className="mt-1 text-article text-ink-700">{c.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

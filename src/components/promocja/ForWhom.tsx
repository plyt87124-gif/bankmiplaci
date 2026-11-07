import { CheckCircle2, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { cooldownBrief, splitLines, type CooldownRule } from "./offerModel";

function Panel({
  icon: Icon,
  iconClass,
  title,
  lines
}: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  lines: string[];
}) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-surface p-4 sm:p-5">
      <h3 className="flex items-start gap-2 text-h4">
        <Icon size={22} aria-hidden="true" className={cn("mt-0.5 shrink-0", iconClass)} />
        {title}
      </h3>
      {lines.length > 1 ? (
        <ul role="list" className="mt-3 list-disc space-y-2 pl-5 text-ui text-ink-700 marker:text-ink-400">
          {lines.map((line) => (
            <li key={line} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 whitespace-pre-line break-words text-ui text-ink-700">{lines[0]}</p>
      )}
    </div>
  );
}

/**
 * "Dla kogo jest promocja?": who can take part (`eligibleFor`) and who cannot
 * (`notEligibleFor`), then the cooldown rule as ONE short line. A free-text field
 * written as separate lines becomes a list, a single paragraph stays one.
 * Empty fields are not shown; with nothing to say the whole section is absent
 * (and the summary bar then has no link to it).
 *
 * The summary bar's "Szczegóły karencji" link lands here (#dla-kogo), so the
 * karencja line stays, but it is kept to a line or two: the section used to
 * repeat the same rule in both cards and again in a boxed block with a
 * heading of its own (owner, 2026-11-07). Write each fact once: the date or
 * period lives in the cooldown fields, the cards say who, not when.
 */
export function ForWhom({
  eligibleFor,
  notEligibleFor,
  cooldown
}: {
  eligibleFor: string | null;
  notEligibleFor: string | null;
  cooldown: CooldownRule | null;
}) {
  const can = splitLines(eligibleFor);
  const cannot = splitLines(notEligibleFor);
  const note = cooldown ? cooldownBrief(cooldown) : null;
  if (can.length === 0 && cannot.length === 0 && !note) return null;

  const panels = (can.length > 0 ? 1 : 0) + (cannot.length > 0 ? 1 : 0);

  return (
    <section id="dla-kogo" aria-labelledby="dla-kogo-h">
      <h2 id="dla-kogo-h">Dla kogo jest promocja?</h2>

      {panels > 0 ? (
        <div className={cn("mt-5 grid gap-4", panels === 2 && "md:grid-cols-2")}>
          {can.length > 0 ? (
            <Panel icon={CheckCircle2} iconClass="text-success" title="Kto może skorzystać" lines={can} />
          ) : null}
          {cannot.length > 0 ? (
            <Panel icon={XCircle} iconClass="text-coral-600" title="Kto nie może" lines={cannot} />
          ) : null}
        </div>
      ) : null}

      {note ? (
        <p className={cn("rounded-card border border-line bg-sunken px-4 py-3 text-small text-ink-700", panels > 0 ? "mt-3" : "mt-5")}>
          {note}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The house look of a choice / action control, copied from the Segment ("Konta osobiste | Konta firmowe",
 * "Wszystkie | Osobiste | Firmowe") that the owner picked as the favourite:
 *
 *  - ON  (selected, primary): SOLID action fill, bold on-action label, a soft drop shadow so it stands up.
 *  - OFF (not selected, secondary): cream (`sunken`) fill, strong grey border, quiet ink text; on hover the action tint
 *    washes in and the border turns action.
 *
 * Shared by Button (primary / secondary), the filter and category chips and the other tab-like controls, so they
 * cannot drift apart. The hover tint is a gradient laid over the SOLID `sunken` colour, never a see-through fill:
 * the background drawings must not show through a control.
 */
export const PILL_ON = "border-action bg-action text-on-action shadow-[0_3px_4px_-1px_rgb(0_0_0/0.28)]";

export const PILL_OFF =
  "border-line-strong bg-sunken text-ink-700 hover:border-action hover:bg-[linear-gradient(rgb(var(--color-action)/0.15),rgb(var(--color-action)/0.15))] hover:text-ink-900";

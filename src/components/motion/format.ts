import { formatPLN } from "@/lib/format";

/**
 * "number" = plain integer count ("12", "1 250" with a non-breaking space).
 * "pln"    = amount in grosze, formatted like everywhere else in the app.
 * A string (not a function) on purpose: server components can pass it to a
 * client component, a callback they could not.
 */
export type CountFormat = "number" | "pln";

const NUMBER_FORMAT = new Intl.NumberFormat("pl-PL");

/** The exact, final text - what the server renders and what the animation lands on. */
export function formatCountValue(value: number, format: CountFormat): string {
  return format === "pln" ? formatPLN(value) : NUMBER_FORMAT.format(value);
}

/**
 * Text for an in-between frame. Rounds to whole units (whole zloty for "pln"),
 * so grosze never flash by mid-count.
 */
export function formatCountFrame(value: number, format: CountFormat): string {
  return format === "pln" ? formatPLN(Math.round(value / 100) * 100) : NUMBER_FORMAT.format(Math.round(value));
}

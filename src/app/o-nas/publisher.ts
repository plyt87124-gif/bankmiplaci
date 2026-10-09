/**
 * Who publishes Bankmiplaci - ONLY the data that is already public in the
 * Regulamin (section 1, "Operatorem Serwisu jest ..."). Nothing here may be
 * added from memory: no team, experts, founding date or company number that the
 * Regulamin does not state. tests/content-pages.test.tsx checks that every
 * value below still appears in src/app/regulamin/page.tsx, so the two cannot
 * drift apart.
 *
 * Other places that need the "Wydawca" line (footer, WP-06) should reuse this
 * object instead of typing the data again.
 */
export const PUBLISHER = {
  name: "Michał Kamiński",
  form: "JDG",
  addressLine: "Stawiszyn 7a, 26-800 Białobrzegi",
  nip: "7981482892",
  regon: "388504613",
  email: "pomoc@bankmiplaci.pl"
} as const;

/** One-line form for a footer: "Michał Kamiński, JDG, Stawiszyn 7a, 26-800 Białobrzegi, NIP 7981482892". */
export function publisherLine(): string {
  return `${PUBLISHER.name}, ${PUBLISHER.form}, ${PUBLISHER.addressLine}, NIP ${PUBLISHER.nip}`;
}

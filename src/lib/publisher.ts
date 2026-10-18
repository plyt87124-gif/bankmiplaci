/**
 * Publisher ("Wydawca") of the service - the ONE place the footer reads it from.
 *
 * ONLY data that is already public in the Regulamin (src/app/regulamin/page.tsx,
 * section 1, "Operator Serwisu") and the Polityka prywatnosci. Nothing here is
 * invented; when the legal pages change, change it here too -
 * tests/navigation.test.tsx fails if the footer data and the Regulamin drift apart.
 *
 * Pure data, no React and no server-only imports.
 */
export const PUBLISHER = {
  /** Natural person operating the service. */
  name: "Michał Kamiński",
  street: "Stawiszyn 7a",
  postalCode: "26-800",
  city: "Białobrzegi",
  email: "pomoc@bankmiplaci.pl"
} as const;

/** "Stawiszyn 7a, 26-800 Białobrzegi" */
export function publisherAddress(): string {
  return `${PUBLISHER.street}, ${PUBLISHER.postalCode} ${PUBLISHER.city}`;
}

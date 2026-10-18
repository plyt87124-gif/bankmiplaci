/** "w ciągu ostatnich 36 miesięcy (3 lat)" — rolling look-back window for a cooldown in months. */
export function formatCooldownWindow(months: number): string {
  if (months === 1) return "w ciągu ostatniego miesiąca";
  let text = `w ciągu ostatnich ${months} miesięcy`;
  if (months % 12 === 0) {
    const years = months / 12;
    text += years === 1 ? " (1 roku)" : ` (${years} lat)`;
  }
  return text;
}

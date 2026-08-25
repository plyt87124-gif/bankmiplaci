import Link from "next/link";

const columns = [
  {
    title: "Serwis",
    links: [
      { href: "/promocje", label: "Wszystkie promocje" },
      { href: "/blog", label: "Centrum wiedzy" },
      { href: "/faq", label: "FAQ" },
      { href: "/kontakt", label: "Kontakt" }
    ]
  },
  {
    title: "Zaufanie",
    links: [
      { href: "/jak-zarabiamy", label: "Jak zarabiamy" },
      { href: "/regulamin", label: "Regulamin" },
      { href: "/polityka-prywatnosci", label: "Polityka prywatności" },
      { href: "/cookies", label: "Cookies" }
    ]
  }
];

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-lg font-semibold text-ink-900">Bankmiplaci</p>
          <p className="mt-3 max-w-sm text-sm text-ink-500">
            Porównujemy aktualne promocje bankowe w Polsce i pokazujemy uczciwie, ile możesz otrzymać oraz co
            musisz zrobić, aby zdobyć premię.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-ink-900">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-500 hover:text-ink-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-100 py-6">
        <div className="container-page flex flex-col gap-2 text-xs text-ink-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Bankmiplaci. Wszystkie prawa zastrzeżone.</p>
          <p>Bankmiplaci nie jest oficjalnym partnerem żadnego z wymienionych banków, chyba że wskazano inaczej.</p>
        </div>
      </div>
    </footer>
  );
}

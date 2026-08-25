export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container-page max-w-2xl py-14">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div className="prose prose-sm mt-6 max-w-none text-ink-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink-900 [&_p]:mt-3">
        {children}
      </div>
    </div>
  );
}

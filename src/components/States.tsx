import { SearchX, Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl2 border border-dashed border-ink-100 bg-surface p-10 text-center">
      <Inbox className="mx-auto h-8 w-8 text-ink-300" />
      <p className="mt-3 font-medium text-ink-700">{title}</p>
      <p className="mt-1 text-sm text-ink-500">{description}</p>
    </div>
  );
}

export function NoResultsState({ query }: { query?: string }) {
  return (
    <div className="rounded-xl2 border border-dashed border-ink-100 bg-surface p-10 text-center">
      <SearchX className="mx-auto h-8 w-8 text-ink-300" />
      <p className="mt-3 font-medium text-ink-700">
        {query ? `Brak promocji dla „${query}”` : "Brak promocji spełniających wybrane filtry"}
      </p>
      <p className="mt-1 text-sm text-ink-500">Spróbuj zmienić filtry lub wyszukać inną frazę.</p>
    </div>
  );
}

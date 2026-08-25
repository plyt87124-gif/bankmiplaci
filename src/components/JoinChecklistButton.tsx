"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, CheckCircle2 } from "lucide-react";
import { useAuthModal } from "@/components/AuthModalProvider";

const today = () => new Date().toISOString().slice(0, 10);

export function JoinChecklistButton({
  promotionId,
  loggedIn,
  alreadyJoined,
  locked
}: {
  promotionId: string;
  loggedIn: boolean;
  alreadyJoined: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [joined, setJoined] = useState(alreadyJoined);
  const [loading, setLoading] = useState(false);
  const [accountOpenedAt, setAccountOpenedAt] = useState(today());

  async function join() {
    setLoading(true);
    const res = await fetch("/api/checklist/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionId, accountOpenedAt })
    });
    setLoading(false);
    if (res.ok) {
      setJoined(true);
      router.push("/konto");
    }
  }

  function onButtonClick() {
    if (loggedIn) join();
    else openAuth({ mode: "login", onSuccess: join });
  }

  if (locked) {
    return (
      <div className="rounded-xl2 border border-teal-100 bg-teal-100/40 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-teal-700">
          <CheckCircle2 className="h-5 w-5" /> Ukończyłeś/aś tę promocję
        </p>
        <p className="mt-1 text-xs text-ink-500">
          Data zamknięcia konta jest już zapisana w Twojej historii bankowej w „Moje konto”. Gdy minie okres
          karencji dla tego banku, ściąga odblokuje się ponownie, żebyś mógł/mogła skorzystać z kolejnej edycji
          tej promocji.
        </p>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-surface p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
          <ListChecks className="h-5 w-5 text-teal-600" /> Śledzisz tę promocję
        </p>
        <p className="mt-1 text-xs text-ink-500">Twoja szczegółowa ściąga czeka w „Moje konto”.</p>
        <Link href="/konto" className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">
          Otwórz ściągę →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-6">
      <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
        <ListChecks className="h-5 w-5 text-teal-600" /> Dołączyłeś/aś do tej promocji?
      </p>
      <p className="mt-1 text-xs text-ink-500">
        Zbudujemy Ci szczegółową, interaktywną ściągę w „Moje konto” — z krokami rozbitymi na miesiące, do
        odznaczania w miarę spełniania warunków.
      </p>

      <div className="mt-3">
        <label htmlFor="account-opened-at" className="text-xs font-medium text-ink-500">
          Kiedy otworzyłeś/aś konto?
        </label>
        <input
          id="account-opened-at"
          type="date"
          value={accountOpenedAt}
          max={today()}
          onChange={(e) => setAccountOpenedAt(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-100 bg-surface px-2.5 py-2 text-sm text-ink-900 outline-none focus:border-teal-500"
        />
        <p className="mt-1 text-[11px] text-ink-300">
          Na tej podstawie odblokujemy kolejne miesiące ściągi dopiero, gdy faktycznie nadejdą.
        </p>
      </div>

      <button
        onClick={onButtonClick}
        disabled={loading || !accountOpenedAt}
        className="mt-3 w-full rounded-full bg-ink-solid py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {loading ? "Dodawanie..." : "Śledź swój postęp"}
      </button>
    </div>
  );
}

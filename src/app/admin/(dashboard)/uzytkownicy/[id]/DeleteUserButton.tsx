"use client";

import { useState, useTransition } from "react";
import { deleteUserAccount } from "../actions";

export function DeleteUserButton({ userId, userLabel }: { userId: string; userLabel: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-full border border-coral-600 px-4 py-2 text-sm font-medium text-coral-600 hover:bg-coral-100"
      >
        Usuń konto
      </button>
    );
  }

  return (
    <div className="rounded-xl2 border border-coral-600 bg-coral-100/40 p-3">
      <p className="text-sm font-medium text-ink-900">
        Na pewno chcesz trwale usunąć konto {userLabel}? Usuniemy też jego komentarze, historię aktywności, ściągi
        i zapisane daty karencji. Tej operacji nie da się cofnąć.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => startTransition(() => deleteUserAccount(userId))}
          disabled={pending}
          className="rounded-full bg-coral-600 px-4 py-2 text-xs font-medium text-white hover:bg-coral-700 disabled:opacity-60"
        >
          {pending ? "Usuwanie..." : "Tak, usuń trwale"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-full border border-ink-100 px-4 py-2 text-xs font-medium text-ink-700"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

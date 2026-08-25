"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function onClick() {
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={onClick} className="text-sm font-medium text-ink-500 hover:text-coral-600">
      Wyloguj się
    </button>
  );
}

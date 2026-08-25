"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/admin/logowanie" })}
      className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-coral-600"
    >
      <LogOut className="h-4 w-4" /> Wyloguj się
    </button>
  );
}

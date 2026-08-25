"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled the native share sheet — do nothing.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — nothing more we can do gracefully.
    }
  }

  return (
    <button
      onClick={handleShare}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-teal-100 bg-teal-100/40 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-100"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link skopiowany!" : "Poleć znajomemu"}
    </button>
  );
}

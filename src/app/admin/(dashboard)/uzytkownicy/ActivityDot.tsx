"use client";

import { useActivityStatus } from "./ActivityProvider";

export function ActivityDot({ userId }: { userId: string }) {
  const status = useActivityStatus(userId);

  if (status === "inactive") return null;

  const isNew = status === "active-new";

  return (
    <span
      className="relative flex h-2.5 w-2.5"
      title={isNew ? "Zalogował/a się po otwarciu tej karty" : "Aktywny/a w ciągu ostatnich 30 dni"}
    >
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
          isNew ? "bg-teal-700" : "bg-teal-400"
        }`}
      />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isNew ? "bg-teal-700" : "bg-teal-500"}`} />
    </span>
  );
}

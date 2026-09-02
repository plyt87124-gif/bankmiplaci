"use client";

import { createContext, useContext, useState } from "react";

interface EarningsContextValue {
  total: number;
  setTotal: (cents: number) => void;
}

const EarningsContext = createContext<EarningsContextValue>({ total: 0, setTotal: () => {} });

/**
 * Lets the lifetime earnings badge live next to the "Moje konto" header
 * (a plain server-rendered row in konto/page.tsx) while the live number is
 * only known inside PromotionChecklist's client-side checked-state.
 * Without this, either both would have to become one giant client
 * component, or the header badge would have to re-derive checked state
 * itself (a second, driftable source of truth). PromotionChecklist pushes
 * its computed total in via setTotal(); EarningsCounter reads it back out.
 */
export function EarningsProvider({ children }: { children: React.ReactNode }) {
  const [total, setTotal] = useState(0);
  return <EarningsContext.Provider value={{ total, setTotal }}>{children}</EarningsContext.Provider>;
}

export function useEarningsContext() {
  return useContext(EarningsContext);
}

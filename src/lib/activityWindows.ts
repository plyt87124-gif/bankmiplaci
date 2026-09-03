// Shared between the server-rendered admin users page and the client-side
// ActivityProvider poll, so the "aktywny/online" threshold can never drift
// out of sync between the two — see ActivityProvider.tsx for why 5 minutes
// specifically (no true heartbeat, this absorbs someone sitting still on
// one page without the dot flickering off mid-read).
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

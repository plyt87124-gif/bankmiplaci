import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userSession";

// Depends on the session cookie, so it must never be prerendered or shared.
export const dynamic = "force-dynamic";

/**
 * Who is signed in, for the client-side SessionProvider (src/components/SessionProvider.tsx).
 *
 * Returns ONLY what the interface needs to render itself: an id and the
 * display name. Never the e-mail, the password hash, consent data, dates or
 * anything else from the User row. Signed out is a normal answer (200,
 * `user: null`), not an error, so the browser console stays clean.
 *
 * `no-store` + `Vary: Cookie`: the answer differs per cookie and must not be
 * kept by the browser, a CDN or any proxy.
 */
export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json(
    { user: user ? { id: user.id, name: user.name } : null },
    { headers: { "Cache-Control": "no-store", Vary: "Cookie" } }
  );
}

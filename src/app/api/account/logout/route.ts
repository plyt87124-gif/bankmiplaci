import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/userSession";

export async function POST() {
  clearUserSession();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/** Explicit GET /api/auth/session so the client always gets JSON (avoids 404 returning HTML). */
export async function GET() {
  const session = await auth()
  return NextResponse.json(session ?? null)
}

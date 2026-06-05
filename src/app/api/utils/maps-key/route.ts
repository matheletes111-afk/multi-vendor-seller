import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const key = process.env.MAP_KEY || ""
  if (!key) {
    return NextResponse.json({ error: "Map API key not configured on server" }, { status: 500 })
  }
  return NextResponse.json({ key })
}

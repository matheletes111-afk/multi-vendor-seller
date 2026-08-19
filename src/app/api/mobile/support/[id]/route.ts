import { NextRequest } from "next/server"
import { GET as inAppGet } from "../in-app/[id]/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return inAppGet(req, context)
}

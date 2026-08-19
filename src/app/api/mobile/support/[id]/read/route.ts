import { NextRequest } from "next/server"
import { POST as inAppReadPost } from "../../in-app/[id]/read/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return inAppReadPost(req, context)
}

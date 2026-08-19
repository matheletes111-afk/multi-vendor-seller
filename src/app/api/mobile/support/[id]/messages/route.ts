import { NextRequest } from "next/server"
import { POST as inAppMessagesPost } from "../../in-app/[id]/messages/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return inAppMessagesPost(req, context)
}

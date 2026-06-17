import { NextRequest, NextResponse } from "next/server"
import { mergeGuestCartForUser } from "@/app/api/customer/cart/merge-logic"
import type { CartMergePayload } from "@/app/api/customer/cart/types"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

export const dynamic = "force-dynamic"

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
}

/** POST /mobileapi/customer/cart/merge — merge guest cart items into DB. Auth: Bearer token (customer). */
export async function POST(request: NextRequest) {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const payload = body as CartMergePayload
  const items = Array.isArray(payload?.items) ? payload.items : []
  await mergeGuestCartForUser(auth.userId, items)

  return NextResponse.json({ success: true })
}


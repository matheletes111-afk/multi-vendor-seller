import { NextRequest, NextResponse } from "next/server"
import { GET as getCategoryById } from "@/app/mobileapi/categories/[id]/route"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/category/:id
 * Direct alias forwarding to /mobileapi/categories/[id]
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const url = new URL(request.url)
  if (id && !url.searchParams.get("id")) {
    url.searchParams.set("id", id)
  }
  const reqWithId = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
  })
  return getCategoryById(reqWithId)
}

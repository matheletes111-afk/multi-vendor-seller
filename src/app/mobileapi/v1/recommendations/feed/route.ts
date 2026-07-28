import { NextRequest, NextResponse } from "next/server"
import { GET as getProductFeed } from "../products/route"
import { GET as getServiceFeed } from "../services/route"
import { GET as getHotelFeed } from "../hotels/route"
import { GET as getFoodFeed } from "../food/route"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") || searchParams.get("vertical")

  if (type === "service") {
    return getServiceFeed(request)
  }
  if (type === "hotel") {
    return getHotelFeed(request)
  }
  if (type === "food") {
    return getFoodFeed(request)
  }

  // Default to product recommendations feed
  return getProductFeed(request)
}

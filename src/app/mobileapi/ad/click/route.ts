import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { recordAdClick } from "@/lib/ad-click-recorder"

// Types
interface ClickResponse {
  success: boolean
  data?: {
    adId: string
    redirectUrl: string
    isClickRecorded: boolean
    message?: string
  }
  error?: string
}

// Helper to get or create session ID from headers
function getOrCreateSessionId(request: NextRequest): { sessionId: string; hadCookie: boolean } {
  const existingSessionId = request.headers.get("x-ad-session-id")
  if (existingSessionId) {
    return { sessionId: existingSessionId, hadCookie: true }
  }
  return { 
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`, 
    hadCookie: false 
  }
}

// GET endpoint for ad clicks (redirect approach)
export async function GET(request: NextRequest): Promise<NextResponse<ClickResponse | any>> {
  try {
    const { searchParams } = new URL(request.url)
    const adId = searchParams.get("adId")
    
    if (!adId) {
      return NextResponse.json({ success: false, error: "adId is required" }, { status: 400 })
    }

    const auth = await getMobileCustomerAuth(request)
    const userId = auth.ok ? auth.userId : null
    const { sessionId, hadCookie } = getOrCreateSessionId(request)

    // Fetch ad details for redirect URL
    const ad = await prisma.sellerAd.findUnique({
      where: { id: adId },
      select: { productId: true, serviceId: true, hotelId: true, foodItemId: true, product: { select: { slug: true } }, service: { select: { slug: true } } }
    })

    if (!ad) {
      return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
    }

    let redirectUrl = "/browse"
    if (ad.productId && ad.product?.slug) {
      redirectUrl = `/product/${ad.productId}`
    } else if (ad.serviceId && ad.service?.slug) {
      redirectUrl = `/service/${ad.serviceId}`
    } else if (ad.hotelId) {
      redirectUrl = `/hotel/${ad.hotelId}`
    } else if (ad.foodItemId) {
      redirectUrl = `/food/${ad.foodItemId}`
    }

    const result = await recordAdClick({ adId, userId, sessionId })

    const response: ClickResponse = {
      success: true,
      data: {
        adId,
        redirectUrl,
        isClickRecorded: !!result.recorded,
        message: result.message || (result.recorded ? "Click recorded" : "Click not recorded")
      }
    }

    const nextResponse = NextResponse.json(response)
    if (!hadCookie) nextResponse.headers.set("X-Ad-Session-Id", sessionId)
    return nextResponse

  } catch (error) {
    console.error("Error processing ad click:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST endpoint for ad clicks (JSON approach)
export async function POST(request: NextRequest): Promise<NextResponse<ClickResponse>> {
  try {
    const body = await request.json()
    const { adId } = body

    if (!adId) {
      return NextResponse.json({ success: false, error: "adId is required" }, { status: 400 })
    }

    const auth = await getMobileCustomerAuth(request)
    const userId = auth.ok ? auth.userId : null
    const { sessionId, hadCookie } = getOrCreateSessionId(request)

    const ad = await prisma.sellerAd.findUnique({
      where: { id: adId },
      select: { productId: true, serviceId: true, hotelId: true, foodItemId: true, product: { select: { slug: true } }, service: { select: { slug: true } } }
    })

    if (!ad) {
      return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
    }

    let redirectUrl = "/browse"
    if (ad.productId && ad.product?.slug) {
      redirectUrl = `/product/${ad.productId}`
    } else if (ad.serviceId && ad.service?.slug) {
      redirectUrl = `/service/${ad.serviceId}`
    } else if (ad.hotelId) {
      redirectUrl = `/hotel/${ad.hotelId}`
    } else if (ad.foodItemId) {
      redirectUrl = `/food/${ad.foodItemId}`
    }

    const result = await recordAdClick({ adId, userId, sessionId })

    const response: ClickResponse = {
      success: true,
      data: {
        adId,
        redirectUrl,
        isClickRecorded: !!result.recorded,
        message: result.message || (result.recorded ? "Click recorded" : "Click not recorded")
      }
    }

    const nextResponse = NextResponse.json(response)
    if (!hadCookie) nextResponse.headers.set("X-Ad-Session-Id", sessionId)
    return nextResponse

  } catch (error) {
    console.error("Error processing ad click:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
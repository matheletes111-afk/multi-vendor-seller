import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

const DEDUP_HOURS = 24

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
  // Check for session ID in request headers (mobile apps should send this)
  const existingSessionId = request.headers.get("x-ad-session-id")
  
  if (existingSessionId) {
    return { sessionId: existingSessionId, hadCookie: true }
  }
  
  // Generate new session ID for new/guest users
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
      return NextResponse.json(
        { success: false, error: "adId is required" },
        { status: 400 }
      )
    }

    // Check for authenticated user
    const auth = getMobileCustomerAuth(request)
    const userId = auth.ok ? auth.userId : null
    
    // Get or create session ID
    const { sessionId, hadCookie } = getOrCreateSessionId(request)

    // Fetch ad details
    const ad = await prisma.sellerAd.findUnique({
      where: { id: adId },
      include: { 
        product: { select: { id: true, slug: true, name: true } },
        service: { select: { id: true, slug: true, name: true } }
      },
    })

    if (!ad) {
      return NextResponse.json(
        { success: false, error: "Ad not found" },
        { status: 404 }
      )
    }

    // Determine redirect URL based on ad type
    let redirectUrl = "/browse"
    if (ad.productId && ad.product?.slug) {
      redirectUrl = `/product/${ad.productId}`
    } else if (ad.serviceId && ad.service?.slug) {
      redirectUrl = `/service/${ad.serviceId}`
    }

    // Validate ad is clickable
    const now = new Date()
    const startAt = new Date(ad.startAt)
    const endAt = new Date(ad.endAt)
    const totalBudget = Number(ad.totalBudget)
    const spentAmount = Number(ad.spentAmount)
    const maxCpc = Number(ad.maxCpc)

    const isActive = ad.status === "ACTIVE"
    const inDateRange = now >= startAt && now <= endAt
    const hasBudget = spentAmount + maxCpc <= totalBudget

    // If ad is not active or out of budget, just return redirect info without recording click
    if (!isActive || !inDateRange || !hasBudget) {
      return NextResponse.json({
        success: true,
        data: {
          adId,
          redirectUrl,
          isClickRecorded: false,
          message: "Ad is not active or has exceeded budget"
        }
      })
    }

    // Check for duplicate clicks (within DEDUP_HOURS)
    const since = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000)
    const existingClick = await prisma.adClick.findFirst({
      where: {
        adId,
        createdAt: { gte: since },
        OR: userId ? [{ userId }, { sessionId }] : [{ sessionId }],
      },
    })

    let isClickRecorded = false

    // Record click if not duplicate
    if (!existingClick) {
      try {
        await prisma.$transaction(async (tx) => {
          // Increment spent amount
          const updated = await tx.sellerAd.update({
            where: { id: adId },
            data: {
              spentAmount: { increment: maxCpc },
            },
          })
          
          const newSpent = Number(updated.spentAmount)
          
          // End ad if budget reached
          if (newSpent >= totalBudget) {
            await tx.sellerAd.update({
              where: { id: adId },
              data: { status: "ENDED" },
            })
          }
          
          // Create click record
          await tx.adClick.create({
            data: {
              adId,
              userId: userId || undefined,
              sessionId: sessionId,
            },
          })
        })
        isClickRecorded = true
      } catch (error) {
        console.error("Error recording ad click:", error)
        // Continue even if recording fails
      }
    }

    // Prepare response
    const response: ClickResponse = {
      success: true,
      data: {
        adId,
        redirectUrl,
        isClickRecorded,
        message: isClickRecorded 
          ? "Click recorded successfully" 
          : existingClick 
            ? "Duplicate click within 24 hours" 
            : "Click not recorded"
      }
    }

    // Return session ID in headers for mobile apps to store
    const nextResponse = NextResponse.json(response)
    
    if (!hadCookie) {
      nextResponse.headers.set("X-Ad-Session-Id", sessionId)
    }

    return nextResponse

  } catch (error) {
    console.error("Error processing ad click:", error)
    return NextResponse.json(
      { success: false, error: "Failed to process ad click" },
      { status: 500 }
    )
  }
}

// POST endpoint for ad clicks (JSON approach - recommended for mobile)
export async function POST(request: NextRequest): Promise<NextResponse<ClickResponse>> {
  try {
    const body = await request.json()
    const { adId } = body

    if (!adId || typeof adId !== "string") {
      return NextResponse.json(
        { success: false, error: "adId is required" },
        { status: 400 }
      )
    }

    // Check for authenticated user
    const auth = getMobileCustomerAuth(request)
    const userId = auth.ok ? auth.userId : null
    
    // Get or create session ID from headers or generate new one
    let sessionId = request.headers.get("x-ad-session-id") || ""
    let hadCookie = !!sessionId
    
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      hadCookie = false
    }

    // Fetch ad details
    const ad = await prisma.sellerAd.findUnique({
      where: { id: adId },
      include: { 
        product: { select: { id: true, slug: true, name: true } },
        service: { select: { id: true, slug: true, name: true } }
      },
    })

    if (!ad) {
      return NextResponse.json(
        { success: false, error: "Ad not found" },
        { status: 404 }
      )
    }

    // Determine redirect URL
    let redirectUrl = "/browse"
    if (ad.productId && ad.product?.slug) {
      redirectUrl = `/product/${ad.productId}`
    } else if (ad.serviceId && ad.service?.slug) {
      redirectUrl = `/service/${ad.serviceId}`
    }

    // Validate ad is clickable
    const now = new Date()
    const startAt = new Date(ad.startAt)
    const endAt = new Date(ad.endAt)
    const totalBudget = Number(ad.totalBudget)
    const spentAmount = Number(ad.spentAmount)
    const maxCpc = Number(ad.maxCpc)

    const isActive = ad.status === "ACTIVE"
    const inDateRange = now >= startAt && now <= endAt
    const hasBudget = spentAmount + maxCpc <= totalBudget

    if (!isActive || !inDateRange || !hasBudget) {
      return NextResponse.json({
        success: true,
        data: {
          adId,
          redirectUrl,
          isClickRecorded: false,
          message: "Ad is not active or has exceeded budget"
        }
      })
    }

    // Check for duplicate clicks
    const since = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000)
    const existingClick = await prisma.adClick.findFirst({
      where: {
        adId,
        createdAt: { gte: since },
        OR: userId ? [{ userId }, { sessionId }] : [{ sessionId }],
      },
    })

    let isClickRecorded = false

    if (!existingClick) {
      try {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.sellerAd.update({
            where: { id: adId },
            data: {
              spentAmount: { increment: maxCpc },
            },
          })
          
          const newSpent = Number(updated.spentAmount)
          
          if (newSpent >= totalBudget) {
            await tx.sellerAd.update({
              where: { id: adId },
              data: { status: "ENDED" },
            })
          }
          
          await tx.adClick.create({
            data: {
              adId,
              userId: userId || undefined,
              sessionId: sessionId,
            },
          })
        })
        isClickRecorded = true
      } catch (error) {
        console.error("Error recording ad click:", error)
      }
    }

    const response: ClickResponse = {
      success: true,
      data: {
        adId,
        redirectUrl,
        isClickRecorded,
        message: isClickRecorded 
          ? "Click recorded successfully" 
          : existingClick 
            ? "Duplicate click within 24 hours" 
            : "Click not recorded"
      }
    }

    const nextResponse = NextResponse.json(response)
    
    // Return new session ID in headers if needed
    if (!hadCookie) {
      nextResponse.headers.set("X-Ad-Session-Id", sessionId)
    }

    return nextResponse

  } catch (error) {
    console.error("Error processing ad click:", error)
    return NextResponse.json(
      { success: false, error: "Failed to process ad click" },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

const DEDUP_HOURS = 24

async function getOrCreateSessionId(): Promise<{ sessionId: string; hadCookie: boolean }> {
  const cookieStore = await cookies()
  const existing = cookieStore.get("ad_session_id")?.value
  if (existing) return { sessionId: existing, hadCookie: true }
  return { sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`, hadCookie: false }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const adId = searchParams.get("adId")
  if (!adId) {
    return NextResponse.redirect(new URL("/customer/browse", request.url))
  }

  const session = await auth()
  const userId = session?.user?.id ?? null
  const { sessionId, hadCookie } = await getOrCreateSessionId()

  const ad = await prisma.sellerAd.findUnique({
    where: { id: adId },
    include: { product: true, service: true },
  })

  if (!ad) {
    return NextResponse.redirect(new URL("/customer/browse", request.url))
  }

  const now = new Date()
  const startAt = new Date(ad.startAt)
  const endAt = new Date(ad.endAt)
  const totalBudget = Number(ad.totalBudget)
  const spentAmount = Number(ad.spentAmount)
  const maxCpc = Number(ad.maxCpc)

  const isActive = ad.status === "ACTIVE"
  const inRange = now >= startAt && now <= endAt
  const hasBudget = spentAmount + maxCpc <= totalBudget

  let redirectUrl = "/customer/browse"
  if (ad.productId && ad.product?.slug) {
    redirectUrl = `/product/${ad.productId}`
  } else if (ad.serviceId && ad.service?.slug) {
    redirectUrl = `/service/${ad.serviceId}`
  }

  const response = NextResponse.redirect(new URL(redirectUrl, request.url))

  if (!isActive || !inRange || !hasBudget) {
    return response
  }

  const since = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000)
  const existingClick = await prisma.adClick.findFirst({
    where: {
      adId,
      createdAt: { gte: since },
      OR: userId ? [{ userId }, { sessionId }] : [{ sessionId }],
    },
  })

  if (existingClick) {
    return response
  }

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
          userId: userId ?? undefined,
          sessionId: sessionId ?? undefined,
        },
      })
    })
  } catch (_) {
    // still redirect
  }

  if (!hadCookie) {
    response.cookies.set("ad_session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })
  }

  return response
}

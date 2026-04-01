import { prisma } from "@/lib/prisma"

const DEDUP_HOURS = 24

export type RecordClickOptions = {
  adId: string
  userId?: string | null
  sessionId?: string | null
}

export async function recordAdClick({ adId, userId, sessionId }: RecordClickOptions) {
  const ad = await prisma.sellerAd.findUnique({
    where: { id: adId },
  })

  if (!ad) return { success: false, error: "Ad not found" }

  const now = new Date()
  const startAt = new Date(ad.startAt)
  const endAt = new Date(ad.endAt)
  const totalBudget = Number(ad.totalBudget)
  const spentAmount = Number(ad.spentAmount)
  const maxCpc = Number(ad.maxCpc)

  const isActive = ad.status === "ACTIVE"
  const inRange = now >= startAt && now <= endAt
  const hasBudget = spentAmount + maxCpc <= totalBudget

  if (!isActive || !inRange || !hasBudget) {
    return { success: false, error: "Ad not active or out of budget" }
  }

  // Deduplication
  const since = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000)
  const existingClick = await prisma.adClick.findFirst({
    where: {
      adId,
      createdAt: { gte: since },
      OR: userId ? (sessionId ? [{ userId }, { sessionId }] : [{ userId }]) : (sessionId ? [{ sessionId }] : []),
    },
  })

  if (existingClick) {
    return { success: true, recorded: false, message: "Duplicate click" }
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

    return { success: true, recorded: true }
  } catch (error) {
    console.error("Error recording ad click:", error)
    return { success: false, error: "Database transaction failed" }
  }
}

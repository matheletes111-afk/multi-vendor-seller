import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { AdminSellerAdsPageClient } from "./page-client"

async function getSellerAds() {
  const ads = await prisma.sellerAd.findMany({
    include: {
      seller: { include: { user: { select: { email: true, name: true } }, store: { select: { name: true } } } },
      product: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
      _count: { select: { adClicks: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return ads.map((ad) => ({
    ...ad,
    totalBudget: Number(ad.totalBudget),
    spentAmount: Number(ad.spentAmount),
    maxCpc: Number(ad.maxCpc),
    targetCountries: ad.targetCountries as string[] | null,
  }))
}

async function approveAd(adId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) return { error: "Unauthorized" }
  const ad = await prisma.sellerAd.findUnique({ where: { id: adId } })
  if (!ad) return { error: "Ad not found" }
  if (ad.status !== "PENDING_APPROVAL") return { error: "Ad is not pending" }
  await prisma.sellerAd.update({ where: { id: adId }, data: { status: "ACTIVE" } })
  revalidatePath("/admin/seller-ads")
  return { success: true }
}

async function rejectAd(adId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) return { error: "Unauthorized" }
  const ad = await prisma.sellerAd.findUnique({ where: { id: adId } })
  if (!ad) return { error: "Ad not found" }
  if (ad.status !== "PENDING_APPROVAL") return { error: "Ad is not pending" }
  await prisma.sellerAd.update({ where: { id: adId }, data: { status: "ENDED" } })
  revalidatePath("/admin/seller-ads")
  return { success: true }
}

export default async function AdminSellerAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/dashboard")

  const ads = await getSellerAds()
  const params = await searchParams

  return (
    <AdminSellerAdsPageClient
      ads={ads}
      params={params}
      approveAd={approveAd}
      rejectAd={rejectAd}
    />
  )
}

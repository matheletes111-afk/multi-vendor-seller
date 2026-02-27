import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ServiceSellerAdmanagementPageClient } from "./page-client"

async function getSellerAds() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return []
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller || seller.type !== "SERVICE") return []
  const ads = await prisma.sellerAd.findMany({
    where: { sellerId: seller.id, serviceId: { not: null } },
    include: {
      service: { select: { id: true, name: true, slug: true } },
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

async function pauseAd(adId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found" }
  const ad = await prisma.sellerAd.findFirst({ where: { id: adId, sellerId: seller.id } })
  if (!ad) return { error: "Ad not found" }
  if (ad.status !== "ACTIVE") return { error: "Ad is not active" }
  await prisma.sellerAd.update({ where: { id: adId }, data: { status: "PAUSED" } })
  revalidatePath("/service-seller/admanagement")
  return { success: true }
}

async function resumeAd(adId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found" }
  const ad = await prisma.sellerAd.findFirst({ where: { id: adId, sellerId: seller.id } })
  if (!ad) return { error: "Ad is not paused" }
  if (ad.status !== "PAUSED") return { error: "Ad is not paused" }
  await prisma.sellerAd.update({ where: { id: adId }, data: { status: "ACTIVE" } })
  revalidatePath("/service-seller/admanagement")
  return { success: true }
}

async function deleteAd(adId: string) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found" }
  const ad = await prisma.sellerAd.findFirst({ where: { id: adId, sellerId: seller.id } })
  if (!ad) return { error: "Ad not found" }
  await prisma.sellerAd.delete({ where: { id: adId } })
  revalidatePath("/service-seller/admanagement")
  return { success: true }
}

async function deleteAdForm(adId: string) {
  "use server"
  const result = await deleteAd(adId)
  if (result.error) redirect(`/service-seller/admanagement?error=${encodeURIComponent(result.error)}`)
  redirect("/service-seller/admanagement?success=Ad deleted")
}

export default async function ServiceSellerAdmanagementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const ads = await getSellerAds()
  const params = await searchParams

  return (
    <ServiceSellerAdmanagementPageClient
      ads={ads}
      params={params}
      pauseAd={pauseAd}
      resumeAd={resumeAd}
      deleteAdForm={deleteAdForm}
    />
  )
}

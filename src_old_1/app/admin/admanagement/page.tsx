import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AdManagementPageClient } from "./page-client"

export default async function AdManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const ads = await prisma.adManagement.findMany({
    orderBy: { createdAt: "desc" },
  })

  const serializedAds = ads.map((ad) => ({
    id: ad.id,
    title: ad.title,
    description: ad.description,
    image: ad.image || null,
    isActive: ad.isActive,
  }))

  return <AdManagementPageClient ads={serializedAds} params={params} />
}

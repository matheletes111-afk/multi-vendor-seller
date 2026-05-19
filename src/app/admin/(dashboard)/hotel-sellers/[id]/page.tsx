import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { HotelSellerDetailClient } from "./hotel-seller-detail-client"

export default async function HotelSellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const { id } = await params

  const seller = await prisma.hotelSeller.findUnique({
    where: { id },
    include: {
      user: true,
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      agreement: true,

      hotels: {
        where: { isDeleted: false },
        include: {
          _count: { select: { rooms: true } }
        }
      }
    }
  })

  if (!seller) notFound()

  return <HotelSellerDetailClient seller={JSON.parse(JSON.stringify(seller))} />
}

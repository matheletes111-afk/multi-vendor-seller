import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { EditHotelClient } from "../edit-hotel-client"

export default async function EditHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    redirect("/hotel-seller/login")
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id }
  })

  if (!seller) redirect("/hotel-seller/login")

  const hotel = await prisma.hotel.findUnique({
    where: { 
      id: id,
      hotelSellerId: seller.id,
      isDeleted: false
    }
  })

  if (!hotel) notFound()

  return <EditHotelClient hotel={hotel as any} />
}

import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { EditRoomClient } from "../edit-room-client"

export default async function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    redirect("/hotel-seller/login")
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id },
    include: { hotels: { where: { isDeleted: false }, select: { id: true, name: true } } }
  })

  if (!seller) redirect("/hotel-seller/login")

  const room = await prisma.room.findFirst({
    where: { 
      id: id,
      hotel: { hotelSellerId: seller.id },
      isDeleted: false
    }
  })

  if (!room) notFound()

  return <EditRoomClient room={room as any} hotels={seller.hotels} />
}

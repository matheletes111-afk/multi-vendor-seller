import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { NewRoomClient } from "../new-room-client"
import { prisma } from "@/lib/prisma"

export default async function NewRoomPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    redirect("/hotel-seller/login")
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id },
    include: { hotels: { where: { isDeleted: false }, select: { id: true, name: true } } }
  })

  if (!seller) redirect("/hotel-seller/login")

  return <NewRoomClient hotels={seller.hotels} />
}

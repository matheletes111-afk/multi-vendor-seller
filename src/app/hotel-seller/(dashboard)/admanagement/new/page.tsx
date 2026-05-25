import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { NewAdClient } from "./new-ad-client"

export default async function HotelSellerNewAdPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) redirect("/hotel-seller/login")
  return <NewAdClient />
}

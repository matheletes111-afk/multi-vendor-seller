import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { HotelSellerAdmanagementPageClient } from "./page-client"

export default async function HotelSellerAdmanagementPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) redirect("/hotel-seller/login")
  return <HotelSellerAdmanagementPageClient />
}

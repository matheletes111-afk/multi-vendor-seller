import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import HotelSettingsClient from "./settings-client"
import { UserRole } from "@prisma/client"

export default async function HotelSellerSettingsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) redirect("/hotel-seller/login")
  return <HotelSettingsClient />
}

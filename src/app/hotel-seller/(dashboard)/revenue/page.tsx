import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isHotelSeller } from "@/lib/rbac"
import { HotelRevenueClient } from "./revenue-client"

export const metadata = {
  title: "My Revenue | Hotel Dashboard",
  description: "Monitor check-in payments, cancellation logs, and net earnings.",
}

export default async function HotelRevenuePage() {
  const session = await auth()
  if (!session?.user || !isHotelSeller(session.user)) redirect("/hotel-seller/login")

  return <HotelRevenueClient />
}

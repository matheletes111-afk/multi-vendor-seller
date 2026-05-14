import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { HotelSellerLayoutClient } from "../layout-client"

export default async function HotelSellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/hotel-seller/login")
  
  return (
    <HotelSellerLayoutClient user={session.user}>
      {children}
    </HotelSellerLayoutClient>
  )
}

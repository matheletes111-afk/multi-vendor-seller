import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RestaurantSellerLayoutClient } from "../layout-client"

export default async function RestaurantSellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/restaurant-seller/login")
  
  return (
    <RestaurantSellerLayoutClient user={session.user}>
      {children}
    </RestaurantSellerLayoutClient>
  )
}

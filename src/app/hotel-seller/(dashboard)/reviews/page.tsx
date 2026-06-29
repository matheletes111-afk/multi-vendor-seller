import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { HotelReviewsClient } from "./reviews-client"

export default async function ReviewsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    redirect("/hotel-seller/login")
  }
  return <HotelReviewsClient />
}

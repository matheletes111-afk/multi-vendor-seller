import { auth } from "@/lib/auth"
import { isRestaurantSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { RestaurantBulkImageUploadClient } from "./restaurant-bulk-image-upload-client"

export default async function RestaurantBulkImageUploadPage() {
  const session = await auth()
  if (!session?.user || !isRestaurantSeller(session.user)) {
    redirect("/restaurant-seller/login")
  }
  return <RestaurantBulkImageUploadClient />
}

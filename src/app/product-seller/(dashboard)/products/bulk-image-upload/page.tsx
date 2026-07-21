import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { BulkImageUploadClient } from "./bulk-image-upload-client"

export default async function BulkImageUploadPage() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/product-seller/login")
  }
  return <BulkImageUploadClient />
}

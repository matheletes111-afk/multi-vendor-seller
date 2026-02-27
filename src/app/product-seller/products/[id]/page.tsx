import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { EditProductClient } from "./edit-product-client"

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/login")
  }
  const { id } = await params
  return <EditProductClient productId={id} />
}

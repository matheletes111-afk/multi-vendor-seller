import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ProductsPageClient } from "./page-client"

async function getSellerProducts() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) return []
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return []
  return prisma.product.findMany({
    where: { sellerId: seller.id },
    include: { category: true, variants: true, _count: { select: { orderItems: true, reviews: true } } },
    orderBy: { createdAt: "desc" },
  })
}

async function deleteProduct(productId: string) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) return { error: "Unauthorized" }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found" }
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.sellerId !== seller.id) return { error: "Product not found" }
  try {
    await prisma.product.delete({ where: { id: productId } })
    revalidatePath("/product-seller/products")
    return { success: true }
  } catch (error: any) {
    return { error: `Delete failed: ${error?.message || "Unknown error"}` }
  }
}

async function deleteProductForm(productId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) redirect("/login?error=session_expired")
  const result = await deleteProduct(productId)
  if (result.error) redirect(`/product-seller/products?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/product-seller/products?success=Product deleted permanently")
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const products = await getSellerProducts()
  const params = await searchParams

  return (
    <ProductsPageClient
      products={products}
      params={params}
      deleteProductForm={deleteProductForm}
    />
  )
}

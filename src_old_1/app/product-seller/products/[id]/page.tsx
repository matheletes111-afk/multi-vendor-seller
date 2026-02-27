import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { PricingFields } from "../pricing-fields"
import Link from "next/link"

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  basePrice: z.number().positive().optional(),
  discount: z.number().min(0).optional(),
  hasGst: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
  sku: z.string().optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

async function updateProduct(productId: string, data: unknown) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) return { error: "Unauthorized" }
  const validated = updateProductSchema.safeParse(data)
  if (!validated.success) return { error: "Invalid data", details: validated.error.errors }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found" }
  const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } })
  if (!product) return { error: "Product not found" }
  let updateData: any = { ...validated.data }
  if (validated.data.name && validated.data.name !== product.name) {
    updateData.slug = validated.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }
  if (validated.data.discount !== undefined) updateData.discount = Math.round(validated.data.discount * 100) / 100
  updateData.hasGst = validated.data.hasGst ?? product.hasGst
  Object.keys(updateData).forEach((k) => { if (updateData[k] === undefined) delete updateData[k] })
  try {
    await prisma.product.update({ where: { id: productId }, data: updateData })
    revalidatePath("/product-seller/products")
    return { success: true }
  } catch (error: any) {
    if (error.code === "P2002") return { error: "Product with this name already exists" }
    return { error: `Failed to update product: ${error.message || "Unknown error"}` }
  }
}

async function updateProductForm(productId: string, formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) redirect("/login?error=session_expired")
  const name = formData.get("name") as string
  const categoryId = formData.get("categoryId") as string
  if (!name || !categoryId) redirect(`/product-seller/products/${productId}?error=missing_required_fields`)
  const imagesInput = (formData.get("images") as string) || ""
  const images = imagesInput ? imagesInput.split("\n").map((u) => u.trim()).filter(Boolean) : []
  const basePriceStr = formData.get("basePrice") as string
  const stockStr = formData.get("stock") as string
  const discountStr = (formData.get("discount") as string) || "0"
  const hasGst = (formData.get("hasGst") as string) === "true"
  const isActive = (formData.get("isActive") as string) === "true"
  let basePrice: number | undefined
  if (basePriceStr?.trim()) { const p = parseFloat(basePriceStr); if (!isNaN(p) && p > 0) basePrice = p }
  let stock: number | undefined
  if (stockStr?.trim()) { const p = parseInt(stockStr); if (!isNaN(p) && p >= 0) stock = p }
  const discount = Math.max(0, isNaN(parseFloat(discountStr)) ? 0 : parseFloat(discountStr))
  const data: any = { name, description: (formData.get("description") as string) || undefined, categoryId, sku: (formData.get("sku") as string) || undefined, isActive, hasGst, discount }
  if (basePrice !== undefined) data.basePrice = basePrice
  if (stock !== undefined) data.stock = stock
  if (images.length > 0) data.images = images
  const result = await updateProduct(productId, data)
  if (result.error) redirect(`/product-seller/products/${productId}?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/product-seller/products?success=Product updated successfully")
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/login")
  }

  const { id } = await params
  const searchParamsResolved = await searchParams

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    redirect("/product-seller/products?error=seller_not_found")
  }

  const product = await prisma.product.findFirst({
    where: {
      id,
      sellerId: seller.id,
    },
    include: {
      category: true,
    },
  })

  if (!product) {
    redirect("/product-seller/products?error=product_not_found")
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })

  const images = Array.isArray(product.images)
    ? product.images as string[]
    : typeof product.images === "string"
      ? JSON.parse(product.images)
      : []

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">Update product information</p>
        </div>
        <Link href="/product-seller/products">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Update the information for your product</CardDescription>
        </CardHeader>
        <CardContent>
          {searchParamsResolved.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {decodeURIComponent(searchParamsResolved.error)}
              </AlertDescription>
            </Alert>
          )}

          {searchParamsResolved.success && (
            <Alert className="mb-4">
              <AlertDescription>
                {decodeURIComponent(searchParamsResolved.success)}
              </AlertDescription>
            </Alert>
          )}

          <form action={updateProductForm.bind(null, product.id)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={product.name}
                placeholder="Enter product name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Product description"
                defaultValue={product.description || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category *</Label>
              <select
                id="categoryId"
                name="categoryId"
                required
                defaultValue={product.categoryId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Pricing</Label>
              <PricingFields
                defaultBasePrice={product.basePrice}
                defaultDiscount={product.discount ?? 0}
                defaultHasGst={product.hasGst ?? true}
                requireBasePrice={true}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Quantity *</Label>
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  min="0"
                  required
                  defaultValue={product.stock}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU (Optional)</Label>
                <Input
                  id="sku"
                  name="sku"
                  defaultValue={product.sku || ""}
                  placeholder="Product SKU"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="images">Image URLs (one per line)</Label>
              <textarea
                id="images"
                name="images"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                defaultValue={images.join("\n")}
              />
              <p className="text-sm text-muted-foreground">
                Enter image URLs, one per line
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={product.isActive}
                value="true"
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="text-sm font-normal">
                Active (Product will be visible to customers)
              </Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit">Update Product</Button>
              <Link href="/product-seller/products">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { checkProductLimit } from "@/lib/subscriptions"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PricingFields } from "../pricing-fields"
import Link from "next/link"

const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.number().positive("Price must be positive"),
  discount: z.number().min(0).optional(),
  hasGst: z.boolean().optional(),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  sku: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
})

async function createProduct(data: unknown) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) return { error: "Unauthorized" }
  const validated = createProductSchema.safeParse(data)
  if (!validated.success) return { error: "Invalid data", details: validated.error.errors }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found. Please complete your seller registration." }
  if (!seller.isApproved) return { error: "Your seller account is pending approval." }
  if (seller.isSuspended) return { error: "Your seller account has been suspended." }
  const limitCheck = await checkProductLimit(seller.id)
  if (!limitCheck.allowed) return { error: `Product limit reached. You have ${limitCheck.current} products and your plan allows ${limitCheck.limit === null ? "unlimited" : limitCheck.limit}. Please upgrade.`, current: limitCheck.current, limit: limitCheck.limit }
  const slug = validated.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const imagesData = validated.data.images && Array.isArray(validated.data.images) ? validated.data.images : []
  const discount = Math.round((validated.data.discount ?? 0) * 100) / 100
  try {
    await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: validated.data.categoryId,
        name: validated.data.name,
        slug,
        description: validated.data.description,
        basePrice: validated.data.basePrice,
        discount,
        hasGst: validated.data.hasGst ?? true,
        stock: validated.data.stock,
        sku: validated.data.sku,
        images: imagesData as any,
      },
    })
    revalidatePath("/product-seller/products")
    return { success: true }
  } catch (error: any) {
    if (error.code === "P2002") return { error: "Product with this name already exists" }
    return { error: `Failed to create product: ${error.message || "Unknown error"}` }
  }
}

async function createProductForm(formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) redirect("/login?error=session_expired")
  const imagesInput = (formData.get("images") as string) || ""
  const images = imagesInput ? imagesInput.split("\n").map((u) => u.trim()).filter(Boolean) : []
  const name = formData.get("name") as string
  const categoryId = formData.get("categoryId") as string
  const basePriceStr = formData.get("basePrice") as string
  const stockStr = formData.get("stock") as string
  const discountStr = (formData.get("discount") as string) || "0"
  const hasGst = (formData.get("hasGst") as string) === "true"
  if (!name || !categoryId) redirect("/product-seller/products/new?error=missing_required_fields")
  if (!basePriceStr || isNaN(parseFloat(basePriceStr))) redirect("/product-seller/products/new?error=invalid_price")
  if (!stockStr || isNaN(parseInt(stockStr))) redirect("/product-seller/products/new?error=invalid_stock")
  const discount = Math.max(0, isNaN(parseFloat(discountStr)) ? 0 : parseFloat(discountStr))
  const data = { name, description: (formData.get("description") as string) || undefined, categoryId, basePrice: parseFloat(basePriceStr), hasGst, discount, stock: parseInt(stockStr), sku: (formData.get("sku") as string) || undefined, images: images.length > 0 ? images : undefined }
  const result = await createProduct(data)
  if (result.error) redirect(`/product-seller/products/new?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/product-seller/products?success=created")
}

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/login")
  }

  const params = await searchParams
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Add New Product</h1>
          <p className="text-muted-foreground">Create a new product listing</p>
        </div>
        <Link href="/product-seller/products">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Fill in the information for your product</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <p className="font-semibold mb-1">Error creating product:</p>
              <p>{decodeURIComponent(params.error)}</p>
              {params.error.includes("limit reached") && (
                <Link href="/product-seller/subscription" className="mt-2 inline-block text-sm underline">
                  Upgrade your subscription →
                </Link>
              )}
            </div>
          )}
          {params.success && (
            <div className="mb-4 rounded-md bg-green-500/15 p-3 text-sm text-green-600">
              Product created successfully!
            </div>
          )}
          <form action={createProductForm} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                name="name"
                required
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category *</Label>
              <select
                id="categoryId"
                name="categoryId"
                required
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
              <PricingFields defaultBasePrice={0} defaultDiscount={0} defaultHasGst={true} requireBasePrice={true} />
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
                  defaultValue="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU (Optional)</Label>
                <Input
                  id="sku"
                  name="sku"
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
              />
              <p className="text-sm text-muted-foreground">
                Enter image URLs, one per line
              </p>
            </div>

            <div className="flex gap-4">
              <Button type="submit">Create Product</Button>
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

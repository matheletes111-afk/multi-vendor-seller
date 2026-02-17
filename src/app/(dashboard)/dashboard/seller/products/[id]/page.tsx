import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateProductForm } from "@/server/actions/products/update-product-form"
import { PricingFields } from "@/components/seller/pricing-fields"
import Link from "next/link"

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

  // Get seller to verify ownership
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    redirect("/dashboard/seller/products?error=seller_not_found")
  }

  // Get product and verify it belongs to the seller
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
    redirect("/dashboard/seller/products?error=product_not_found")
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })

  // Parse images from JSON
  const images = Array.isArray(product.images) 
    ? product.images as string[] 
    : typeof product.images === 'string' 
      ? JSON.parse(product.images) 
      : []

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">Update product information</p>
        </div>
        <Link href="/dashboard/seller/products">
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
              <Link href="/dashboard/seller/products">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


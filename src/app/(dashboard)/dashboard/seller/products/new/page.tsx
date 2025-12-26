import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProductForm } from "@/server/actions/products/create-product-form"
import Link from "next/link"

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
        <Link href="/dashboard/seller/products">
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
                <Link href="/dashboard/seller/subscription" className="mt-2 inline-block text-sm underline">
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

            <div className="grid gap-4 md:grid-cols-2">
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
                <Label htmlFor="basePrice">Price *</Label>
                <Input
                  id="basePrice"
                  name="basePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                />
              </div>
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


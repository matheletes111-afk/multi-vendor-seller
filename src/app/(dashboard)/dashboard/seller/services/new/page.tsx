import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createServiceForm } from "@/server/actions/services/create-service-form"
import { PricingFields } from "@/components/seller/pricing-fields"
import Link from "next/link"

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()
  
  if (!session?.user || !isServiceSeller(session.user)) {
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
          <h1 className="text-3xl font-bold">Add New Service</h1>
          <p className="text-muted-foreground">Create a new service listing</p>
        </div>
        <Link href="/dashboard/seller/services">
          <Button variant="outline">Back to Services</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
          <CardDescription>Fill in the information for your service</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <p className="font-semibold mb-1">Error creating service:</p>
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
              Service created successfully!
            </div>
          )}
          <form action={createServiceForm} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Enter service name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Service description"
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
                <Label htmlFor="serviceType">Service Type *</Label>
                <select
                  id="serviceType"
                  name="serviceType"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select type</option>
                  <option value="APPOINTMENT">Appointment-based</option>
                  <option value="FIXED_PRICE">Fixed Price</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Pricing</Label>
              <PricingFields
                basePriceLabel="Base price (for fixed-price services)"
                defaultBasePrice={0}
                defaultDiscount={0}
                defaultHasGst={true}
                showBasePrice={true}
                requireBasePrice={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration in minutes (for appointments)</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                min="1"
                placeholder="60"
              />
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
              <Button type="submit">Create Service</Button>
              <Link href="/dashboard/seller/services">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


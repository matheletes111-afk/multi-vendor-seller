import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { PricingFields } from "../pricing-fields"
import Link from "next/link"

const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  categoryId: z.string().min(1).optional(),
  serviceType: z.enum(["APPOINTMENT", "FIXED_PRICE"]).optional(),
  basePrice: z.number().positive().optional().nullable(),
  discount: z.number().min(0).optional(),
  hasGst: z.boolean().optional(),
  duration: z.number().int().positive().optional().nullable(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

async function updateService(serviceId: string, data: unknown) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found" }
  const service = await prisma.service.findFirst({ where: { id: serviceId, sellerId: seller.id } })
  if (!service) return { error: "Service not found" }
  const validated = updateServiceSchema.safeParse(data)
  if (!validated.success) return { error: "Validation failed", details: validated.error.errors }
  let updateData: any = { ...validated.data }
  if (validated.data.name && validated.data.name !== service.name) {
    updateData.slug = validated.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }
  if (validated.data.discount !== undefined) updateData.discount = Math.round(validated.data.discount * 100) / 100
  updateData.hasGst = validated.data.hasGst ?? service.hasGst
  Object.keys(updateData).forEach((k) => { if (updateData[k] === undefined) delete updateData[k] })
  if (updateData.images !== undefined) updateData.images = Array.isArray(updateData.images) ? updateData.images : []
  try {
    await prisma.service.update({ where: { id: serviceId }, data: updateData })
    revalidatePath("/service-seller/services")
    return { success: true }
  } catch (error: any) {
    if (error.code === "P2002") return { error: "Service with this name already exists" }
    return { error: `Failed to update service: ${error.message || "Unknown error"}` }
  }
}

async function updateServiceForm(serviceId: string, formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login?error=session_expired")
  const name = formData.get("name") as string
  const categoryId = formData.get("categoryId") as string
  const serviceType = formData.get("serviceType") as "APPOINTMENT" | "FIXED_PRICE"
  if (!name || !categoryId || !serviceType) redirect(`/service-seller/services/${serviceId}?error=missing_required_fields`)
  const imagesInput = (formData.get("images") as string) || ""
  const images = imagesInput ? imagesInput.split("\n").map((u) => u.trim()).filter(Boolean) : []
  const basePriceInput = formData.get("basePrice") as string
  const durationInput = formData.get("duration") as string
  const discountStr = (formData.get("discount") as string) || "0"
  const hasGst = (formData.get("hasGst") as string) === "true"
  const isActive = (formData.get("isActive") as string) === "true"
  let basePrice: number | undefined
  if (basePriceInput?.trim()) { const p = parseFloat(basePriceInput); if (!isNaN(p) && p > 0) basePrice = p }
  let duration: number | undefined
  if (durationInput?.trim()) { const p = parseInt(durationInput); if (!isNaN(p) && p > 0) duration = p }
  const discount = Math.max(0, isNaN(parseFloat(discountStr)) ? 0 : parseFloat(discountStr))
  const data: any = { name, description: (formData.get("description") as string) || undefined, categoryId, serviceType, isActive, hasGst, discount }
  if (basePrice !== undefined) data.basePrice = basePrice
  if (duration !== undefined) data.duration = duration
  if (images.length > 0) data.images = images
  const result = await updateService(serviceId, data)
  if (result.error) redirect(`/service-seller/services/${serviceId}?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/service-seller/services?success=Service updated successfully")
}

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/login")
  }

  const { id } = await params
  const searchParamsResolved = await searchParams

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    redirect("/service-seller/services?error=seller_not_found")
  }

  const service = await prisma.service.findFirst({
    where: {
      id,
      sellerId: seller.id,
    },
    include: {
      category: true,
    },
  })

  if (!service) {
    redirect("/service-seller/services?error=service_not_found")
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })

  const images = Array.isArray(service.images)
    ? service.images as string[]
    : typeof service.images === "string"
      ? JSON.parse(service.images)
      : []

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Service</h1>
          <p className="text-muted-foreground">Update service information</p>
        </div>
        <Link href="/service-seller/services">
          <Button variant="outline">Back to Services</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
          <CardDescription>Update the information for your service</CardDescription>
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

          <form action={updateServiceForm.bind(null, service.id)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={service.name}
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
                defaultValue={service.description || ""}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="categoryId">Category *</Label>
                <select
                  id="categoryId"
                  name="categoryId"
                  required
                  defaultValue={service.categoryId}
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
                  defaultValue={service.serviceType}
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
                defaultBasePrice={service.basePrice ?? 0}
                defaultDiscount={service.discount ?? 0}
                defaultHasGst={service.hasGst ?? true}
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
                defaultValue={service.duration || ""}
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
                defaultChecked={service.isActive}
                value="true"
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="text-sm font-normal">
                Active (Service will be visible to customers)
              </Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit">Update Service</Button>
              <Link href="/service-seller/services">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

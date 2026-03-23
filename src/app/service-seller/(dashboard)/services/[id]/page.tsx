import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { uploadServiceFormImages } from "@/lib/upload-service-form-images"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { PricingFields } from "../pricing-fields"
import { ServiceImageInput } from "../service-image-input"
import { WeeklyAvailabilityFields } from "../weekly-availability-fields"
import Link from "next/link"

const weeklyAvailabilitySchema = z.array(
  z.object({ unavailable: z.boolean(), shiftStart: z.string(), shiftEnd: z.string() })
).length(7).optional().nullable()

const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  serviceCategoryId: z.string().min(1).optional(),
  serviceType: z.enum(["APPOINTMENT", "FIXED_PRICE"]).optional(),
  basePrice: z.number().positive().optional().nullable(),
  discount: z.number().min(0).optional(),
  hasGst: z.boolean().optional(),
  duration: z.number().int().positive().optional().nullable(),
  images: z.array(z.string()).optional(),
  weeklyAvailability: weeklyAvailabilitySchema,
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
  if (updateData.weeklyAvailability !== undefined) updateData.weeklyAvailability = updateData.weeklyAvailability
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
  if (!session?.user || !isServiceSeller(session.user)) redirect("/service-seller/login?error=session_expired")
  const name = formData.get("name") as string
  const serviceCategoryId = formData.get("serviceCategoryId") as string
  const serviceType = formData.get("serviceType") as "APPOINTMENT" | "FIXED_PRICE"
  if (!name || !serviceCategoryId || !serviceType) redirect(`/service-seller/services/${serviceId}?error=missing_required_fields`)
  let uploadedUrls: string[] = []
  try {
    uploadedUrls = await uploadServiceFormImages(formData)
  } catch (e) {
    redirect(
      `/service-seller/services/${serviceId}?error=${encodeURIComponent(e instanceof Error ? e.message : "Upload failed")}`
    )
  }
  const imagesInput = (formData.get("images") as string) || ""
  const linkUrls = imagesInput ? imagesInput.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean) : []
  const images = Array.from(new Set([...linkUrls, ...uploadedUrls]))
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
  let weeklyAvailability: unknown = undefined
  const waRaw = formData.get("weeklyAvailability") as string | null
  if (waRaw) {
    try {
      const parsed = JSON.parse(waRaw)
      if (Array.isArray(parsed) && parsed.length === 7) weeklyAvailability = parsed
    } catch {
      /* ignore */
    }
  }
  const data: any = { name, description: (formData.get("description") as string) || undefined, serviceCategoryId, serviceType, isActive, hasGst, discount, weeklyAvailability }
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
    redirect("/service-seller/login")
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
      serviceCategory: true,
    },
  })

  if (!service) {
    redirect("/service-seller/services?error=service_not_found")
  }

  const categories = await prisma.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })

  const images = Array.isArray(service.images)
    ? service.images as string[]
    : typeof service.images === "string"
      ? JSON.parse(service.images)
      : []

  const weeklyAvailability = service.weeklyAvailability ?? undefined

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  const textareaClass = "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Edit Service</h1>
          <p className="text-muted-foreground mt-1">Update service information</p>
        </div>
        <Link href="/service-seller/services">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">Back to Services</Button>
        </Link>
      </div>

      {searchParamsResolved.error && (
        <Card className="mb-6 border-destructive/50">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>{decodeURIComponent(searchParamsResolved.error)}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
      {searchParamsResolved.success && (
        <Card className="mb-6 border-green-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-green-700 dark:text-green-400">{decodeURIComponent(searchParamsResolved.success)}</p>
          </CardContent>
        </Card>
      )}

      <form action={updateServiceForm.bind(null, service.id)} className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Basic information</CardTitle>
            <CardDescription>Name, description, category and type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Service name *</Label>
              <Input id="name" name="name" required defaultValue={service.name} placeholder="e.g. Home cleaning" className="max-w-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" name="description" className={textareaClass} placeholder="Describe your service" defaultValue={service.description || ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceCategoryId">Category *</Label>
                <select id="serviceCategoryId" name="serviceCategoryId" required defaultValue={service.serviceCategoryId} className={selectClass}>
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service type *</Label>
                <select id="serviceType" name="serviceType" required defaultValue={service.serviceType} className={selectClass}>
                  <option value="">Select type</option>
                  <option value="APPOINTMENT">Appointment-based</option>
                  <option value="FIXED_PRICE">Fixed price</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Pricing & duration</CardTitle>
            <CardDescription>Base price, discount and duration for appointments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <PricingFields
              basePriceLabel="Base price (for fixed-price services)"
              defaultBasePrice={service.basePrice ?? 0}
              defaultDiscount={service.discount ?? 0}
              defaultHasGst={service.hasGst ?? true}
              showBasePrice={true}
              requireBasePrice={false}
            />
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes, for appointments)</Label>
              <Input id="duration" name="duration" type="number" min="1" defaultValue={service.duration ?? ""} placeholder="60" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Weekly availability</CardTitle>
            <CardDescription>Check the days you’re available and set shift times; uncheck a day to mark it closed</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <WeeklyAvailabilityFields defaultValue={weeklyAvailability} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Images</CardTitle>
            <CardDescription>Upload images — they are saved when you update the service</CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceImageInput
              defaultUrls={images}
              label="Service images"
              hint="Choose one or more images. Upload runs when you click Update service."
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={service.isActive}
                value="true"
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
                Active (service visible to customers)
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Link href="/service-seller/services" className="sm:order-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button>
          </Link>
          <Button type="submit" className="w-full sm:w-auto sm:order-1">Update service</Button>
        </div>
      </form>
    </div>
  )
}

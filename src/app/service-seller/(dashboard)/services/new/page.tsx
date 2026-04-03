import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { checkServiceLimit } from "@/lib/subscriptions"
import { uploadMasterServiceImage, uploadServiceGalleryImages } from "@/lib/upload-service-form-images"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PricingFields } from "../pricing-fields"
import { ServiceMasterImageInput } from "../service-master-image-input"
import { ServiceGalleryImageInput } from "../service-gallery-image-input"
import { WeeklyAvailabilityFields } from "../weekly-availability-fields"
import Link from "next/link"

const weeklyAvailabilitySchema = z.array(
  z.object({
    unavailable: z.boolean(),
    shiftStart: z.string(),
    shiftEnd: z.string(),
  })
).length(7).optional().nullable()

const createServiceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  serviceCategoryId: z.string().min(1, "Service category is required"),
  serviceType: z.enum(["APPOINTMENT", "FIXED_PRICE"]),
  basePrice: z.number().positive().optional().nullable(),
  discount: z.number().min(0).optional(),
  hasGst: z.boolean().optional(),
  duration: z.number().int().positive().optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  galleryImages: z.array(z.string()).optional().nullable(),
  weeklyAvailability: weeklyAvailabilitySchema,
  isActive: z.boolean().optional(),
})

async function createService(data: unknown) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const validated = createServiceSchema.safeParse(data)
  if (!validated.success) return { error: "Validation failed", details: validated.error.errors }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found." }
  if (!seller.isApproved) return { error: "Your seller account is pending approval." }
  if (seller.isSuspended) return { error: "Your seller account has been suspended." }
  const limitCheck = await checkServiceLimit(seller.id)
  if (!limitCheck.allowed) return { error: `Service limit reached. You have ${limitCheck.current} and your plan allows ${limitCheck.limit === null ? "unlimited" : limitCheck.limit}. Please upgrade.` }
  const slug = validated.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const imagesData = validated.data.images && Array.isArray(validated.data.images) ? validated.data.images : []
  const galleryData =
    validated.data.galleryImages && Array.isArray(validated.data.galleryImages) ? validated.data.galleryImages : []
  const basePrice = validated.data.basePrice ?? null
  const discount = Math.round((validated.data.discount ?? 0) * 100) / 100
  const weeklyAvailability = validated.data.weeklyAvailability ?? undefined
  try {
    await prisma.service.create({
      data: {
        sellerId: seller.id,
        serviceCategoryId: validated.data.serviceCategoryId,
        name: validated.data.name,
        slug,
        description: validated.data.description,
        serviceType: validated.data.serviceType,
        basePrice,
        discount,
        hasGst: validated.data.hasGst ?? true,
        duration: validated.data.duration,
        weeklyAvailability: weeklyAvailability as any,
        images: imagesData as any,
        galleryImages: galleryData as any,
      },
    })
    revalidatePath("/service-seller/services")
    return { success: true }
  } catch (error: any) {
    if (error.code === "P2002") return { error: "Service with this name already exists" }
    return { error: `Failed to create service: ${error.message || "Unknown error"}` }
  }
}

async function createServiceForm(formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/service-seller/login?error=session_expired")
  const name = formData.get("name") as string
  const serviceCategoryId = formData.get("serviceCategoryId") as string
  const serviceType = formData.get("serviceType") as "APPOINTMENT" | "FIXED_PRICE"
  if (!name || !serviceCategoryId || !serviceType) redirect("/service-seller/services/new?error=missing_required_fields")
  let masterUpload: string | null = null
  let galleryUploads: string[] = []
  try {
    masterUpload = await uploadMasterServiceImage(formData)
    galleryUploads = await uploadServiceGalleryImages(formData)
  } catch (e) {
    redirect(`/service-seller/services/new?error=${encodeURIComponent(e instanceof Error ? e.message : "Upload failed")}`)
  }
  const masterUrlRaw = (formData.get("masterImageUrl") as string)?.trim() || ""
  const master = masterUpload || masterUrlRaw || null
  const galleryRaw = (formData.get("galleryImageUrls") as string) || ""
  const linkGallery = galleryRaw.split(/[\n\r]+/).map((u) => u.trim()).filter(Boolean)
  const gallery = Array.from(new Set([...linkGallery, ...galleryUploads]))
  const images = master ? [master] : []
  const basePriceInput = formData.get("basePrice") as string
  const durationInput = formData.get("duration") as string
  const discountStr = (formData.get("discount") as string) || "0"
  const hasGst = (formData.get("hasGst") as string) === "true"
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
  const data = {
    name,
    description: (formData.get("description") as string) || undefined,
    serviceCategoryId,
    serviceType,
    basePrice,
    hasGst,
    discount,
    duration,
    images: images.length > 0 ? images : undefined,
    galleryImages: gallery,
    weeklyAvailability,
  }
  const result = await createService(data)
  if (result.error) redirect(`/service-seller/services/new?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/service-seller/services?success=created")
}

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/service-seller/login")
  }

  const params = await searchParams
  const sellerWithCats = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: {
      selectedServiceCategories: {
        where: { isActive: true },
        orderBy: { name: "asc" }
      }
    }
  })
  const categories = sellerWithCats?.selectedServiceCategories || []

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  const textareaClass = "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Add New Service</h1>
          <p className="text-muted-foreground mt-1">Create a new service listing</p>
        </div>
        <Link href="/service-seller/services">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">Back to Services</Button>
        </Link>
      </div>

      {params.error && (
        <Card className="mb-6 border-destructive/50">
          <CardContent className="pt-6">
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-semibold mb-1">Error creating service</p>
              <p>{decodeURIComponent(params.error)}</p>
              {params.error.includes("limit reached") && (
                <Link href="/service-seller/subscription" className="mt-2 inline-block text-sm underline">
                  Upgrade your subscription →
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {params.success && (
        <Card className="mb-6 border-green-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-green-700 dark:text-green-400">Service created successfully!</p>
          </CardContent>
        </Card>
      )}

      <form action={createServiceForm} className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Basic information</CardTitle>
            <CardDescription>Name, description, category and type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Service name *</Label>
              <Input id="name" name="name" required placeholder="e.g. Home cleaning" className="max-w-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" name="description" className={textareaClass} placeholder="Describe your service" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceCategoryId">Category *</Label>
                <select id="serviceCategoryId" name="serviceCategoryId" required className={selectClass}>
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service type *</Label>
                <select id="serviceType" name="serviceType" required className={selectClass}>
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
              defaultBasePrice={0}
              defaultDiscount={0}
              defaultHasGst={true}
              showBasePrice={true}
              requireBasePrice={false}
            />
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes, for appointments)</Label>
              <Input id="duration" name="duration" type="number" min="1" placeholder="60" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Weekly availability</CardTitle>
            <CardDescription>Check the days you’re available and set shift times; uncheck a day to mark it closed</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <WeeklyAvailabilityFields />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Images</CardTitle>
            <CardDescription>Master image and gallery upload to your bucket when you create the service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-10">
            <ServiceMasterImageInput
              hint="Shown in listings and as the main photo. Uploads when you click Create service."
            />
            <ServiceGalleryImageInput
              hint="Additional photos with preview. Uploads when you click Create service."
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Link href="/service-seller/services" className="sm:order-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button>
          </Link>
          <Button type="submit" className="w-full sm:w-auto sm:order-1">Create service</Button>
        </div>
      </form>
    </div>
  )
}

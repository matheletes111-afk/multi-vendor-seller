import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import Link from "next/link"
import { saveAdCreativeFile, validateAdCreativeFile } from "@/lib/ad-upload"
import { ServiceAdFormClient } from "./service-ad-form-client"

const createAdSchema = z.object({
  adType: z.enum(["promote_service", "own_ad"]).optional(),
  serviceId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  placements: z.array(z.enum(["WEB", "MOBILE"])).min(1, "At least one placement is required"),
  creativeType: z.enum(["IMAGE", "VIDEO"]).optional(),
  creativeUrl: z.string().optional(),
  mobileCreativeType: z.enum(["IMAGE", "VIDEO"]).optional(),
  mobileCreativeUrl: z.string().optional(),
  totalBudget: z.number().positive("Budget must be positive"),
  maxCpc: z.number().positive("Max CPC must be positive"),
  startAt: z.string().min(1, "Start date is required"),
  endAt: z.string().min(1, "End date is required"),
  targetAudience: z.number().int().min(1).optional(),
  targetCountries: z.string().optional(),
  targetAgeMin: z.number().int().min(0).max(120).optional(),
  targetAgeMax: z.number().int().min(0).max(120).optional(),
  expandAudience: z.boolean().optional(),
})

async function createAd(data: unknown) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const validated = createAdSchema.safeParse(data)
  if (!validated.success) {
    return { error: `Invalid data: ${validated.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")}`, details: validated.error.errors }
  }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller || seller.type !== "SERVICE") return { error: "Seller not found" }
  const isOwnAd = validated.data.adType === "own_ad"
  if (!isOwnAd && !validated.data.serviceId) return { error: "Service is required" }
  let service = null
  if (!isOwnAd) {
    service = await prisma.service.findFirst({ where: { id: validated.data.serviceId, sellerId: seller.id } })
    if (!service) return { error: "Service not found" }
  }
  const startAt = new Date(validated.data.startAt)
  const endAt = new Date(validated.data.endAt)
  if (endAt <= startAt) return { error: "End date must be after start date" }
  if (validated.data.maxCpc > validated.data.totalBudget) return { error: "Max CPC cannot exceed total budget" }
  
  if (validated.data.placements.includes("WEB") && !validated.data.creativeUrl) {
    return { error: "Web Creative is required when Web placement is selected" }
  }
  if (validated.data.placements.includes("MOBILE") && !validated.data.mobileCreativeUrl) {
    return { error: "Mobile Creative is required when Mobile placement is selected" }
  }
  let countries: string[] | null = null
  if (validated.data.targetCountries) {
    const raw = validated.data.targetCountries as string
    try {
      const parsed = JSON.parse(raw)
      countries = Array.isArray(parsed) ? parsed.map((c: unknown) => String(c).trim()).filter(Boolean) : null
    } catch {
      countries = raw.split(",").map((c) => c.trim()).filter(Boolean)
    }
  }
  const ageMin = validated.data.targetAgeMin
  const ageMax = validated.data.targetAgeMax
  if (ageMin != null && ageMax != null && ageMin > ageMax) return { error: "Min age cannot be greater than max age" }
    
    // Bypass TS type checking for un-generated fields
    const adData: any = {
      sellerId: seller.id,
      customerUserId: null,
      serviceId: isOwnAd ? null : validated.data.serviceId,
      title: validated.data.title,
      description: validated.data.description || null,
      placements: validated.data.placements,
      creativeType: validated.data.creativeType || "IMAGE",
      creativeUrl: validated.data.creativeUrl || validated.data.mobileCreativeUrl || "",
      mobileCreativeType: validated.data.mobileCreativeType,
      mobileCreativeUrl: validated.data.mobileCreativeUrl,
      status: "PENDING_APPROVAL",
      totalBudget: validated.data.totalBudget,
      spentAmount: 0,
      maxCpc: validated.data.maxCpc,
      targetAudience: validated.data.targetAudience ?? null,
      startAt,
      endAt,
      targetCountries: countries?.length ? (countries as unknown as object) : undefined,
      targetAgeMin: ageMin ?? null,
      targetAgeMax: ageMax ?? null,
      expandAudience: validated.data.expandAudience ?? false,
    }

    try {
      await prisma.sellerAd.create({ data: adData })
    revalidatePath("/service-seller/admanagement")
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { error: `Failed to create ad: ${message}` }
  }
}

async function createAdForm(formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/service-seller/login?error=session_expired")
  const adType = formData.get("adType") as string
  const isOwnAd = adType === "own_ad"
  const serviceId = (formData.get("serviceId") as string) || undefined
  const title = formData.get("title") as string
  const placements = formData.getAll("placements") as ("WEB" | "MOBILE")[]
  const hasWeb = placements.includes("WEB")
  const hasMobile = placements.includes("MOBILE")

  if (placements.length === 0) {
    redirect("/service-seller/admanagement/new?error=missing_placements")
  }

  const creativeType = (formData.get("creativeType") as string) || "IMAGE"
  const creativeFile = formData.get("creativeFile") as File | null
  let creativeUrl = (formData.get("creativeUrl") as string) || ""

  if (hasWeb && creativeFile && creativeFile.size > 0) {
    const check = validateAdCreativeFile(creativeFile)
    if (!check.ok) redirect(`/service-seller/admanagement/new?error=${encodeURIComponent("Web Creative: " + check.error)}`)
    try {
      creativeUrl = await saveAdCreativeFile(creativeFile)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed"
      redirect(`/service-seller/admanagement/new?error=${encodeURIComponent(msg)}`)
    }
  }

  const mobileCreativeType = (formData.get("mobilecreativeType") as string) || "IMAGE"
  const mobileCreativeFile = formData.get("mobilecreativeFile") as File | null
  let mobileCreativeUrl = (formData.get("mobilecreativeUrl") as string) || ""

  if (hasMobile && mobileCreativeFile && mobileCreativeFile.size > 0) {
    const check = validateAdCreativeFile(mobileCreativeFile)
    if (!check.ok) redirect(`/service-seller/admanagement/new?error=${encodeURIComponent("Mobile Creative: " + check.error)}`)
    try {
      mobileCreativeUrl = await saveAdCreativeFile(mobileCreativeFile)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed"
      redirect(`/service-seller/admanagement/new?error=${encodeURIComponent(msg)}`)
    }
  }
  const totalBudgetStr = formData.get("totalBudget") as string
  let maxCpcStr = (formData.get("maxCpc") as string) || ""
  const targetAudienceStr = (formData.get("targetAudience") as string) || ""
  const startAt = formData.get("startAt") as string
  const endAt = formData.get("endAt") as string
  const targetCountries = (formData.get("targetCountries") as string) || ""
  const expandAudience = (formData.get("expandAudience") as string) === "on"
  if ((!isOwnAd && !serviceId) || !title || !totalBudgetStr || !startAt || !endAt) {
    redirect("/service-seller/admanagement/new?error=missing_required_fields")
  }
  if (hasWeb && !creativeUrl) {
    redirect("/service-seller/admanagement/new?error=missing_web_creative")
  }
  if (hasMobile && !mobileCreativeUrl) {
    redirect("/service-seller/admanagement/new?error=missing_mobile_creative")
  }
  const totalBudget = parseFloat(totalBudgetStr)
  const targetAudience = targetAudienceStr ? parseInt(targetAudienceStr, 10) : 0
  if (!maxCpcStr && targetAudience >= 1) {
    maxCpcStr = (totalBudget / targetAudience).toFixed(2)
  }
  const maxCpc = parseFloat(maxCpcStr)
  if (isNaN(totalBudget) || totalBudget <= 0 || isNaN(maxCpc) || maxCpc <= 0) {
    redirect("/service-seller/admanagement/new?error=invalid_budget_or_audience")
  }
  const targetAgeMinStr = (formData.get("targetAgeMin") as string) || ""
  const targetAgeMaxStr = (formData.get("targetAgeMax") as string) || ""
  const targetAgeMin = targetAgeMinStr ? parseInt(targetAgeMinStr, 10) : undefined
  const targetAgeMax = targetAgeMaxStr ? parseInt(targetAgeMaxStr, 10) : undefined
  const data = {
    adType,
    serviceId,
    title,
    description: (formData.get("description") as string) || undefined,
    placements,
    creativeType: creativeType === "VIDEO" ? "VIDEO" as const : "IMAGE" as const,
    creativeUrl: creativeUrl || undefined,
    mobileCreativeType: mobileCreativeType === "VIDEO" ? "VIDEO" as const : "IMAGE" as const,
    mobileCreativeUrl: mobileCreativeUrl || undefined,
    totalBudget,
    maxCpc,
    targetAudience: targetAudience >= 1 ? targetAudience : undefined,
    startAt,
    endAt,
    targetCountries: targetCountries || undefined,
    targetAgeMin: targetAgeMin != null && !isNaN(targetAgeMin) ? targetAgeMin : undefined,
    targetAgeMax: targetAgeMax != null && !isNaN(targetAgeMax) ? targetAgeMax : undefined,
    expandAudience,
  }
  const result = await createAd(data)
  if (result.error) {
    redirect(`/service-seller/admanagement/new?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  }
  redirect("/service-seller/admanagement?success=Ad created. It will be visible after admin approval.")
}

export default async function NewAdPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/service-seller/login")

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller || seller.type !== "SERVICE") redirect("/service-seller")

  const services = await prisma.service.findMany({
    where: { sellerId: seller.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const params = await searchParams

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Create Ad</h1>
          <p className="text-muted-foreground">Promote a service. You pay only when customers click (CPC).</p>
        </div>
        <Link href="/service-seller/admanagement">
          <Button variant="outline">Back to Ads</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad details</CardTitle>
          <CardDescription>One ad = one service + one creative (image or video) + budget + dates</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {decodeURIComponent(params.error)}
            </div>
          )}
          <ServiceAdFormClient services={services} action={createAdForm} />
        </CardContent>
      </Card>
    </div>
  )
}

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
import Link from "next/link"
import { AdCreativeField } from "@/components/ads/ad-creative-field"
import { BudgetAudienceField } from "@/components/ads/budget-audience-field"
import { CountryMultiSelect } from "@/components/ads/country-multi-select"
import { saveAdCreativeFile, validateAdCreativeFile } from "@/lib/ad-upload"

const createAdSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  creativeType: z.enum(["IMAGE", "VIDEO"]),
  creativeUrl: z.string().min(1, "Creative URL or file is required"),
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
  if (!session?.user || !isProductSeller(session.user)) return { error: "Unauthorized" }
  const validated = createAdSchema.safeParse(data)
  if (!validated.success) return { error: "Invalid data", details: validated.error.errors }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller || seller.type !== "PRODUCT") return { error: "Seller not found" }
  const product = await prisma.product.findFirst({ where: { id: validated.data.productId, sellerId: seller.id } })
  if (!product) return { error: "Product not found" }
  const startAt = new Date(validated.data.startAt)
  const endAt = new Date(validated.data.endAt)
  if (endAt <= startAt) return { error: "End date must be after start date" }
  if (validated.data.maxCpc > validated.data.totalBudget) return { error: "Max CPC cannot exceed total budget" }
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
  try {
    await prisma.sellerAd.create({
      data: {
        sellerId: seller.id,
        productId: validated.data.productId,
        title: validated.data.title,
        description: validated.data.description || null,
        creativeType: validated.data.creativeType,
        creativeUrl: validated.data.creativeUrl,
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
      },
    })
    revalidatePath("/product-seller/admanagement")
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { error: `Failed to create ad: ${message}` }
  }
}

async function createAdForm(formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) redirect("/login?error=session_expired")
  const productId = formData.get("productId") as string
  const title = formData.get("title") as string
  const creativeType = (formData.get("creativeType") as string) || "IMAGE"
  const creativeFile = formData.get("creativeFile") as File | null
  let creativeUrl = (formData.get("creativeUrl") as string) || ""
  if (creativeFile && creativeFile.size > 0) {
    const check = validateAdCreativeFile(creativeFile)
    if (!check.ok) redirect(`/product-seller/admanagement/new?error=${encodeURIComponent(check.error)}`)
    try {
      creativeUrl = await saveAdCreativeFile(creativeFile)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed"
      redirect(`/product-seller/admanagement/new?error=${encodeURIComponent(msg)}`)
    }
  }
  const totalBudgetStr = formData.get("totalBudget") as string
  let maxCpcStr = (formData.get("maxCpc") as string) || ""
  const targetAudienceStr = (formData.get("targetAudience") as string) || ""
  const startAt = formData.get("startAt") as string
  const endAt = formData.get("endAt") as string
  const targetCountries = (formData.get("targetCountries") as string) || ""
  const expandAudience = (formData.get("expandAudience") as string) === "on"
  if (!productId || !title || !creativeUrl || !totalBudgetStr || !startAt || !endAt) {
    redirect("/product-seller/admanagement/new?error=missing_required_fields")
  }
  const totalBudget = parseFloat(totalBudgetStr)
  const targetAudience = targetAudienceStr ? parseInt(targetAudienceStr, 10) : 0
  if (!maxCpcStr && targetAudience >= 1) {
    maxCpcStr = (totalBudget / targetAudience).toFixed(2)
  }
  const maxCpc = parseFloat(maxCpcStr)
  if (isNaN(totalBudget) || totalBudget <= 0 || isNaN(maxCpc) || maxCpc <= 0) {
    redirect("/product-seller/admanagement/new?error=invalid_budget_or_audience")
  }
  const targetAgeMinStr = (formData.get("targetAgeMin") as string) || ""
  const targetAgeMaxStr = (formData.get("targetAgeMax") as string) || ""
  const targetAgeMin = targetAgeMinStr ? parseInt(targetAgeMinStr, 10) : undefined
  const targetAgeMax = targetAgeMaxStr ? parseInt(targetAgeMaxStr, 10) : undefined
  const data = {
    productId,
    title,
    description: (formData.get("description") as string) || undefined,
    creativeType: creativeType === "VIDEO" ? "VIDEO" as const : "IMAGE" as const,
    creativeUrl,
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
    redirect(`/product-seller/admanagement/new?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  }
  redirect("/product-seller/admanagement?success=Ad created. It will be visible after admin approval.")
}

export default async function NewAdPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) redirect("/login")

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller || seller.type !== "PRODUCT") redirect("/product-seller")

  const products = await prisma.product.findMany({
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
          <p className="text-muted-foreground">Promote a product. You pay only when customers click (CPC).</p>
        </div>
        <Link href="/product-seller/admanagement">
          <Button variant="outline">Back to Ads</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad details</CardTitle>
          <CardDescription>One ad = one product + one creative (image or video) + budget + dates</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {decodeURIComponent(params.error)}
            </div>
          )}
          <form action={createAdForm} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="productId">Product to promote *</Label>
              <select
                id="productId"
                name="productId"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground">Create a product first from Products.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Ad title *</Label>
              <Input id="title" name="title" required placeholder="e.g. Summer Sale - 20% Off" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <textarea
                id="description"
                name="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Short description for the ad"
              />
            </div>

            <AdCreativeField />

            <BudgetAudienceField />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startAt">Start date *</Label>
                <Input id="startAt" name="startAt" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endAt">End date *</Label>
                <Input id="endAt" name="endAt" type="datetime-local" required />
              </div>
            </div>

            <CountryMultiSelect />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetAgeMin">Target age min (optional)</Label>
                <Input
                  id="targetAgeMin"
                  name="targetAgeMin"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="e.g. 18"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAgeMax">Target age max (optional)</Label>
                <Input
                  id="targetAgeMax"
                  name="targetAgeMax"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="e.g. 65"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="expandAudience" name="expandAudience" className="rounded border-input" />
                <Label htmlFor="expandAudience">Expand audience</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When on: if your target countries would show the ad to very few people, we may show it to a broader audience so it still gets reach. When off: ad is shown only to users matching your selected countries.
              </p>
            </div>

            <div className="flex gap-4">
              <Button type="submit">Create Ad</Button>
              <Link href="/product-seller/admanagement">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

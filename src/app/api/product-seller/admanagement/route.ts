import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { saveAdCreativeFile, validateAdCreativeFile } from "@/lib/ad-upload"

export async function GET() {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller || seller.type !== "PRODUCT") {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const ads = await prisma.sellerAd.findMany({
    where: { sellerId: seller.id, productId: { not: null } },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      _count: { select: { adClicks: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const serialized = ads.map((ad) => ({
    ...ad,
    totalBudget: Number(ad.totalBudget),
    spentAmount: Number(ad.spentAmount),
    maxCpc: Number(ad.maxCpc),
    targetCountries: ad.targetCountries as string[] | null,
  }))

  return NextResponse.json(serialized)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })
  if (!seller || seller.type !== "PRODUCT") {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  let body: Record<string, string | number | boolean | undefined>
  const contentType = request.headers.get("content-type") || ""
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const creativeFile = formData.get("creativeFile") as File | null
    let creativeUrl = (formData.get("creativeUrl") as string) || ""
    if (creativeFile && creativeFile.size > 0) {
      const check = validateAdCreativeFile(creativeFile)
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
      try {
        creativeUrl = await saveAdCreativeFile(creativeFile)
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 })
      }
    }
    const totalBudgetStr = (formData.get("totalBudget") as string) || ""
    const maxCpcStr = (formData.get("maxCpc") as string) || ""
    const targetAudienceStr = (formData.get("targetAudience") as string) || ""
    const totalBudget = parseFloat(totalBudgetStr)
    let maxCpc = parseFloat(maxCpcStr)
    if (!maxCpcStr && targetAudienceStr) {
      const aud = parseInt(targetAudienceStr, 10)
      if (aud >= 1) maxCpc = totalBudget / aud
    }
    body = {
      productId: formData.get("productId") as string,
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      creativeType: ((formData.get("creativeType") as string) || "IMAGE") as "IMAGE" | "VIDEO",
      creativeUrl,
      totalBudget,
      maxCpc,
      startAt: formData.get("startAt") as string,
      endAt: formData.get("endAt") as string,
      targetCountries: (formData.get("targetCountries") as string) || undefined,
      targetAudience: targetAudienceStr ? parseInt(targetAudienceStr, 10) : undefined,
      targetAgeMin: (formData.get("targetAgeMin") as string) ? parseInt((formData.get("targetAgeMin") as string), 10) : undefined,
      targetAgeMax: (formData.get("targetAgeMax") as string) ? parseInt((formData.get("targetAgeMax") as string), 10) : undefined,
      expandAudience: (formData.get("expandAudience") as string) === "on",
    } as unknown as Record<string, string | number | boolean | undefined>
  } else {
    body = await request.json().catch(() => ({})) as Record<string, string | number | boolean | undefined>
  }

  const productId = String(body.productId ?? "")
  const title = String(body.title ?? "").trim()
  const creativeUrl = String(body.creativeUrl ?? "").trim()
  const creativeType = body.creativeType === "VIDEO" ? "VIDEO" : "IMAGE"
  const totalBudget = Number(body.totalBudget ?? 0)
  const maxCpc = Number(body.maxCpc ?? 0)
  const startAt = new Date(String(body.startAt ?? ""))
  const endAt = new Date(String(body.endAt ?? ""))

  if (!productId || !title || !creativeUrl) {
    return NextResponse.json({ error: "productId, title, and creative URL are required" }, { status: 400 })
  }
  if (isNaN(totalBudget) || totalBudget <= 0 || isNaN(maxCpc) || maxCpc <= 0) {
    return NextResponse.json({ error: "Valid totalBudget and maxCpc required" }, { status: 400 })
  }
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "Valid startAt and endAt required" }, { status: 400 })
  }
  if (endAt <= startAt) return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })

  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.id },
  })
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  let targetCountries: string[] | null = null
  const tc = body.targetCountries
  if (tc) {
    try {
      const parsed = typeof tc === "string" ? JSON.parse(tc) : tc
      targetCountries = Array.isArray(parsed) ? parsed.map((c: unknown) => String(c).trim()).filter(Boolean) : null
    } catch {
      targetCountries = String(tc).split(",").map((c) => c.trim()).filter(Boolean)
    }
  }

  const targetAgeMin = body.targetAgeMin != null && !isNaN(Number(body.targetAgeMin)) ? Number(body.targetAgeMin) : null
  const targetAgeMax = body.targetAgeMax != null && !isNaN(Number(body.targetAgeMax)) ? Number(body.targetAgeMax) : null
  const targetAudience = body.targetAudience != null && Number(body.targetAudience) >= 1 ? Number(body.targetAudience) : null

  try {
    await prisma.sellerAd.create({
      data: {
        sellerId: seller.id,
        productId,
        title,
        description: (body.description as string) || null,
        creativeType,
        creativeUrl,
        status: "PENDING_APPROVAL",
        totalBudget,
        spentAmount: 0,
        maxCpc,
        targetAudience,
        startAt,
        endAt,
        targetCountries: targetCountries?.length ? (targetCountries as unknown as object) : undefined,
        targetAgeMin,
        targetAgeMax,
        expandAudience: body.expandAudience === true,
      },
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Failed to create ad: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    )
  }
}

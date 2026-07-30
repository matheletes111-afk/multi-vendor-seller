import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { saveAdCreativeFile } from "@/lib/ad-upload"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const ad = await prisma.sellerAd.findFirst({
    where: { id, sellerId: seller.id },
    include: {
      product: true,
      _count: { select: { adClicks: true } },
    },
  })

  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...ad,
    totalBudget: Number(ad.totalBudget),
    spentAmount: Number(ad.spentAmount),
    maxCpc: Number(ad.maxCpc),
    targetCountries: ad.targetCountries as string[] | null,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const ad = await prisma.sellerAd.findFirst({
    where: { id, sellerId: seller.id },
  })

  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 })
  }

  const contentType = request.headers.get("content-type") || ""

  // Status-only update (JSON with single status field)
  if (contentType.includes("application/json")) {
    const jsonBody = await request.json().catch(() => ({}))
    if (Object.keys(jsonBody).length === 1 && jsonBody.status) {
      const { status } = jsonBody
      if (status === "PAUSED" && ad.status === "ACTIVE") {
        await prisma.sellerAd.update({ where: { id }, data: { status: "PAUSED" } })
        return NextResponse.json({ success: true, status: "PAUSED" })
      }
      if (status === "ACTIVE" && ad.status === "PAUSED") {
        await prisma.sellerAd.update({ where: { id }, data: { status: "ACTIVE" } })
        return NextResponse.json({ success: true, status: "ACTIVE" })
      }
      return NextResponse.json({ error: "Invalid status change" }, { status: 400 })
    }
  }

  // Full ad update (multipart/form-data or JSON with multiple fields)
  try {
    let body: any = {}
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const placements = formData.getAll("placements") as string[]
      
      let creativeUrl = (formData.get("creativeUrl") as string) || ad.creativeUrl || ""
      const creativeFile = formData.get("creativeFile") as File | null
      if (creativeFile && creativeFile.size > 0) {
        creativeUrl = await saveAdCreativeFile(creativeFile)
      }

      let mobileCreativeUrl = (formData.get("mobileCreativeUrl") as string) || ad.mobileCreativeUrl || ""
      const mobileCreativeFile = formData.get("mobileCreativeFile") as File | null
      if (mobileCreativeFile && mobileCreativeFile.size > 0) {
        mobileCreativeUrl = await saveAdCreativeFile(mobileCreativeFile)
      }

      body = {
        adType: formData.get("adType") as string,
        productId: formData.get("productId") as string,
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        placements: placements.length > 0 ? placements : undefined,
        creativeType: formData.get("creativeType") as string,
        creativeUrl,
        mobileCreativeType: formData.get("mobileCreativeType") as string,
        mobileCreativeUrl,
        totalBudget: formData.get("totalBudget") ? parseFloat(formData.get("totalBudget") as string) : undefined,
        maxCpc: formData.get("maxCpc") ? parseFloat(formData.get("maxCpc") as string) : undefined,
        startAt: formData.get("startAt") as string,
        endAt: formData.get("endAt") as string,
        targetCountries: formData.get("targetCountries") as string,
        targetAgeMin: formData.get("targetAgeMin") ? parseInt(formData.get("targetAgeMin") as string) : undefined,
        targetAgeMax: formData.get("targetAgeMax") ? parseInt(formData.get("targetAgeMax") as string) : undefined,
        targetAudience: formData.get("targetAudience") ? parseInt(formData.get("targetAudience") as string) : undefined,
        expandAudience: formData.get("expandAudience") === "on" || formData.get("expandAudience") === "true",
      }
    } else {
      body = await request.json()
    }

    const adType = String(body.adType || "promote_product").trim().toLowerCase()
    const isOwnAd = adType === "own_ad" || adType === "ownad"
    const productId = isOwnAd ? null : (body.productId ? String(body.productId).trim() : ad.productId)
    const title = body.title ? String(body.title).trim() : ad.title

    let placements: string[] = ad.placements && ad.placements.length > 0 ? (ad.placements as string[]) : ["WEB"]
    const rawPlacements = body.placements
    if (Array.isArray(rawPlacements)) {
      placements = rawPlacements.flatMap((p: any) => String(p).split(",")).map((p: string) => p.trim().toUpperCase())
    } else if (typeof rawPlacements === "string" && rawPlacements.trim()) {
      placements = rawPlacements.split(",").map((p: string) => p.trim().toUpperCase())
    }
    placements = placements.filter((p) => p === "WEB" || p === "MOBILE")
    if (placements.length === 0) placements = ["WEB"]

    const creativeUrl = body.creativeUrl !== undefined ? String(body.creativeUrl).trim() : ad.creativeUrl
    const mobileCreativeUrl = body.mobileCreativeUrl !== undefined ? String(body.mobileCreativeUrl).trim() : ad.mobileCreativeUrl
    const totalBudget = body.totalBudget ? Number(body.totalBudget) : Number(ad.totalBudget)
    const maxCpc = body.maxCpc ? Number(body.maxCpc) : Number(ad.maxCpc)
    const startAt = body.startAt ? new Date(String(body.startAt)) : ad.startAt
    const endAt = body.endAt ? new Date(String(body.endAt)) : ad.endAt

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    if (productId) {
      const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } })
      if (!product) return NextResponse.json({ error: "Product not found or does not belong to you" }, { status: 404 })
    }

    let targetCountries: string[] | null = (ad.targetCountries as string[]) || null
    if (body.targetCountries !== undefined) {
      const tc = body.targetCountries
      if (!tc) {
        targetCountries = null
      } else {
        try {
          const parsed = typeof tc === "string" ? JSON.parse(tc) : tc
          targetCountries = Array.isArray(parsed) ? parsed.map((c: any) => String(c).trim()).filter(Boolean) : null
        } catch {
          targetCountries = String(tc).split(",").map((c) => c.trim()).filter(Boolean)
        }
      }
    }

    // Reset status to PENDING_APPROVAL for admin re-review upon edit
    const newStatus = "PENDING_APPROVAL"

    const updatedAd = await prisma.sellerAd.update({
      where: { id },
      data: {
        productId,
        title,
        description: body.description !== undefined ? body.description : ad.description,
        // @ts-ignore
        placements,
        creativeType: body.creativeType ? (body.creativeType === "VIDEO" ? "VIDEO" : "IMAGE") : ad.creativeType,
        creativeUrl: creativeUrl || mobileCreativeUrl || ad.creativeUrl,
        // @ts-ignore
        mobileCreativeType: body.mobileCreativeType ? (body.mobileCreativeType === "VIDEO" ? "VIDEO" : "IMAGE") : ad.mobileCreativeType,
        mobileCreativeUrl: mobileCreativeUrl || null,
        status: newStatus,
        totalBudget,
        maxCpc,
        startAt,
        endAt,
        targetCountries: targetCountries ? (targetCountries as any) : null,
        targetAgeMin: body.targetAgeMin !== undefined ? (body.targetAgeMin ? Number(body.targetAgeMin) : null) : ad.targetAgeMin,
        targetAgeMax: body.targetAgeMax !== undefined ? (body.targetAgeMax ? Number(body.targetAgeMax) : null) : ad.targetAgeMax,
        targetAudience: body.targetAudience !== undefined ? (body.targetAudience ? Number(body.targetAudience) : null) : ad.targetAudience,
        expandAudience: body.expandAudience !== undefined ? Boolean(body.expandAudience) : ad.expandAudience,
      },
    })

    return NextResponse.json({ success: true, data: updatedAd })
  } catch (err: any) {
    console.error("Product seller edit ad error:", err)
    return NextResponse.json({ error: err.message || "Failed to update ad" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  const ad = await prisma.sellerAd.findFirst({ where: { id, sellerId: seller.id } })
  if (!ad) return NextResponse.json({ error: "Ad not found" }, { status: 404 })
  await prisma.sellerAd.update({ where: { id }, data: { status: "ENDED" } })
  return NextResponse.json({ success: true })
}

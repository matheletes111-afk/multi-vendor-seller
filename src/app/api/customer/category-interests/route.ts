import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type CategoryRow = {
  id: string
  name: string
  slug: string
  image: string | null
  mobileIcon: string | null
}

/** GET — customer session: categories for picker + whether onboarding modal should show. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== UserRole.CUSTOMER) {
      return NextResponse.json({
        needsPrompt: false,
        isCustomer: false,
        categories: [] as CategoryRow[],
        selectedIds: [] as string[],
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { categoryInterestPromptCompletedAt: true },
    })

    const [categories, interests] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, image: true, mobileIcon: true },
      }),
      prisma.userCategoryInterest.findMany({
        where: { userId: session.user.id },
        select: { categoryId: true },
      }),
    ])

    let selectedIds = interests.map((i) => i.categoryId)
    let needsPrompt = user?.categoryInterestPromptCompletedAt == null

    if (needsPrompt && categories.length === 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { categoryInterestPromptCompletedAt: new Date() },
      })
      needsPrompt = false
    }

    return NextResponse.json({
      needsPrompt,
      isCustomer: true,
      categories,
      selectedIds,
    })
  } catch (e) {
    console.error("GET /api/customer/category-interests:", e)
    return NextResponse.json({ error: "Failed to load category interests" }, { status: 500 })
  }
}

/** POST — save selected categories or skip onboarding. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { categoryIds?: unknown; skip?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const skip = body.skip === true
  const rawIds = body.categoryIds
  const categoryIds =
    Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : []

  if (!skip && categoryIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one category, or use Skip for now." },
      { status: 400 }
    )
  }

  if (!skip) {
    const existing = await prisma.category.findMany({
      where: { id: { in: categoryIds }, isActive: true },
      select: { id: true },
    })
    if (existing.length !== categoryIds.length) {
      return NextResponse.json({ error: "One or more categories are invalid." }, { status: 400 })
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userCategoryInterest.deleteMany({ where: { userId: session.user.id } })
      if (!skip && categoryIds.length > 0) {
        await tx.userCategoryInterest.createMany({
          data: categoryIds.map((categoryId) => ({
            userId: session.user.id,
            categoryId,
          })),
        })
      }
      await tx.user.update({
        where: { id: session.user.id },
        data: { categoryInterestPromptCompletedAt: new Date() },
      })
    })

    const saved = await prisma.userCategoryInterest.findMany({
      where: { userId: session.user.id },
      select: { categoryId: true },
    })

    return NextResponse.json({
      success: true,
      selectedIds: saved.map((s) => s.categoryId),
    })
  } catch (e) {
    console.error("POST /api/customer/category-interests:", e)
    return NextResponse.json({ error: "Failed to save category interests" }, { status: 500 })
  }
}

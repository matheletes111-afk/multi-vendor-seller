import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

/** Prisma delegate after `npx prisma generate` (UserCategoryInterest + User.categoryInterestPromptCompletedAt). */
const p = prisma as any

// Types
interface CategoryInterestResponse {
  success: boolean
  data?: {
    userId: string
    categories: {
      id: string
      name: string
      slug: string
      image: string | null
      mobileIcon: string | null
    }[]
    /** ISO timestamp when onboarding was finished; null if never completed. */
    completedAt: string | null
    /** True until the user saves interests or skips (aligns with web home prompt). */
    needsPrompt: boolean
  }
  error?: string
}

interface PostBody {
  categoryIds?: string[]
  skip?: boolean
}

// POST: Save user category interests
export async function POST(request: NextRequest): Promise<NextResponse<CategoryInterestResponse>> {
  try {
    // Authenticate user
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      )
    }

    // Parse and validate body
    let body: PostBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const rawIds = body.categoryIds
    const categoryIds =
      Array.isArray(rawIds) ? [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))] : []

    /** Explicit skip, or legacy `categoryIds: []` (clear interests + finish onboarding). */
    const skip = body.skip === true || (Array.isArray(rawIds) && rawIds.length === 0)

    if (!skip && !Array.isArray(rawIds)) {
      return NextResponse.json(
        { success: false, error: "categoryIds must be an array, or send skip: true" },
        { status: 400 }
      )
    }

    if (!skip && categoryIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Select at least one category, or send skip: true, or use an empty categoryIds array" },
        { status: 400 }
      )
    }

    if (!skip) {
      const existingCategories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds },
          isActive: true,
        },
        select: { id: true },
      })

      if (existingCategories.length !== categoryIds.length) {
        return NextResponse.json(
          { success: false, error: "One or more category IDs are invalid or inactive" },
          { status: 400 }
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      const t = tx as any
      await t.userCategoryInterest.deleteMany({
        where: { userId: auth.userId },
      })

      if (!skip && categoryIds.length > 0) {
        await t.userCategoryInterest.createMany({
          data: categoryIds.map((categoryId) => ({
            userId: auth.userId,
            categoryId,
          })),
        })
      }

      await t.user.update({
        where: { id: auth.userId },
        data: { categoryInterestPromptCompletedAt: new Date() },
      })
    })

    // Fetch the saved interests for response
    const savedInterests = await p.userCategoryInterest.findMany({
      where: { userId: auth.userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            mobileIcon: true
          }
        }
      }
    })

    const userAfter = await p.user.findUnique({
      where: { id: auth.userId },
      select: { categoryInterestPromptCompletedAt: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: auth.userId,
        categories: savedInterests.map((interest: { category: { id: string; name: string; slug: string; image: string | null; mobileIcon: string | null } }) => ({
          id: interest.category.id,
          name: interest.category.name,
          slug: interest.category.slug,
          image: interest.category.image,
          mobileIcon: interest.category.mobileIcon,
        })),
        completedAt: userAfter?.categoryInterestPromptCompletedAt?.toISOString() ?? null,
        needsPrompt: false,
      },
    })

  } catch (error) {
    console.error("Error saving category interests:", error)
    return NextResponse.json(
      { success: false, error: "Failed to save category interests" },
      { status: 500 }
    )
  }
}

// GET: Fetch user category interests
export async function GET(request: NextRequest): Promise<NextResponse<CategoryInterestResponse>> {
  try {
    // Authenticate user
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      )
    }

    // Fetch user interests with category details
    const interests = await p.userCategoryInterest.findMany({
      where: { userId: auth.userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            mobileIcon: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    })

    // Get user's prompt completion status
    const user = await p.user.findUnique({
      where: { id: auth.userId },
      select: { categoryInterestPromptCompletedAt: true },
    })

    const needsPrompt = user?.categoryInterestPromptCompletedAt == null

    return NextResponse.json({
      success: true,
      data: {
        userId: auth.userId,
        categories: interests.map((interest: { category: { id: string; name: string; slug: string; image: string | null; mobileIcon: string | null } }) => ({
          id: interest.category.id,
          name: interest.category.name,
          slug: interest.category.slug,
          image: interest.category.image,
          mobileIcon: interest.category.mobileIcon,
        })),
        completedAt: user?.categoryInterestPromptCompletedAt?.toISOString() ?? null,
        needsPrompt,
      },
    })

  } catch (error) {
    console.error("Error fetching category interests:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch category interests" },
      { status: 500 }
    )
  }
}
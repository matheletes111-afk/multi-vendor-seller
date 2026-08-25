import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

type ReviewType = "product" | "service" | "hotel" | "food"

/** DELETE /api/admin/reviews/[type]/[id]/[reviewId] — admin deletes a single review */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string; reviewId: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, reviewId } = await params
  const normalizedType = type === "restaurant" ? "food" : type
  const reviewType = (["product", "service", "hotel", "food"].includes(normalizedType)
    ? normalizedType
    : null) as ReviewType | null

  if (!reviewType) return NextResponse.json({ error: "Invalid review type" }, { status: 400 })
  if (!reviewId) return NextResponse.json({ error: "Missing reviewId" }, { status: 400 })

  try {
    if (reviewType === "hotel") {
      await prisma.hotelReview.delete({ where: { id: reviewId } })
    } else if (reviewType === "food") {
      await prisma.foodReview.delete({ where: { id: reviewId } })
    } else {
      // product or service — both use the Review model
      await prisma.review.delete({ where: { id: reviewId } })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Review not found or already deleted" }, { status: 404 })
  }
}

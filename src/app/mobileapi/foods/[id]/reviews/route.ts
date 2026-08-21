import { NextRequest } from "next/server"
import { GET as getFoodReviews, POST as postFoodReview, PUT as putFoodReview } from "@/app/mobileapi/customer/foods/[id]/reviews/route"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return getFoodReviews(request, props)
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return postFoodReview(request, props)
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return putFoodReview(request, props)
}

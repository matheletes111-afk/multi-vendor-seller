import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "PRODUCT_SERVICE" // "PRODUCT_SERVICE", "HOTEL", "RESTAURANT"

    const plans = await prisma.plan.findMany({
      where: {
        type: type as any
      },
      orderBy: { price: "asc" }
    })

    return NextResponse.json({ plans })
  } catch (error: any) {
    console.error("Mobile get subscription plans error:", error)
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    )
  }
}

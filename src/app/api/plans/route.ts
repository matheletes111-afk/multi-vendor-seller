import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PlanType } from "@prisma/client"

/** GET all plans (for subscription pages). Public. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get("type") || "PRODUCT_SERVICE"
    const type = typeParam.toUpperCase() as PlanType

    const plans = await prisma.plan.findMany({
      where: { type },
      orderBy: { price: "asc" },
    })
    return NextResponse.json(plans)
  } catch (error) {
    console.error("Error fetching plans:", error)
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { SubscriptionPlan, PlanType } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      type,
      displayName,
      description,
      price,
      duration,
      maxProducts,
      maxOrders,
      maxRooms,
      features,
    } = body

    if (!name || !type || !displayName || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const p = parseFloat(price)
    if (isNaN(p) || p < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 })
    }

    // Rule: Can't create a 0 RS plan if one already exists for this type
    if (p === 0) {
      const existingFree = await prisma.plan.findFirst({
        where: { price: 0, type: type as PlanType }
      })
      if (existingFree) {
        return NextResponse.json(
          { error: "A 0 RS plan already exists for this seller type." },
          { status: 400 }
        )
      }
    }

    const planDuration = parseInt(duration, 10) || 30

    // Check if a plan with the same name, type, and duration already exists
    const duplicate = await prisma.plan.findFirst({
      where: {
        name: name as SubscriptionPlan,
        type: type as PlanType,
        duration: planDuration,
      }
    })
    if (duplicate) {
      return NextResponse.json(
        { error: "A plan with this name, type, and duration already exists." },
        { status: 400 }
      )
    }

    // Parse limits
    let limitProducts: number | null = null
    if (maxProducts !== null && maxProducts !== "unlimited" && maxProducts !== "") {
      const n = parseInt(maxProducts, 10)
      if (!isNaN(n)) limitProducts = n
    }

    let limitOrders: number | null = null
    if (maxOrders !== null && maxOrders !== "unlimited" && maxOrders !== "") {
      const n = parseInt(maxOrders, 10)
      if (!isNaN(n)) limitOrders = n
    }

    let limitRooms: number | null = null
    if (type === "HOTEL") {
      if (maxRooms !== null && maxRooms !== "unlimited" && maxRooms !== "") {
        const n = parseInt(maxRooms, 10)
        if (!isNaN(n)) limitRooms = n
      }
    }

    const plan = await prisma.plan.create({
      data: {
        name: name as SubscriptionPlan,
        type: type as PlanType,
        displayName,
        description,
        price: p,
        duration: planDuration,
        maxProducts: limitProducts,
        maxOrders: limitOrders,
        maxRooms: limitRooms,
        features: features || {},
      }
    })

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    console.error("Error creating plan:", error)
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    return NextResponse.json(plan)
  } catch (error) {
    console.error("Error fetching plan:", error)
    return NextResponse.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      displayName,
      description,
      price,
      maxProducts,
      maxOrders,
      features,
    } = body

    const updateData: Record<string, unknown> = {}
    if (displayName !== undefined) updateData.displayName = displayName
    if (description !== undefined) updateData.description = description
    if (typeof price === "number") updateData.price = price
    if (maxProducts === null || maxProducts === "unlimited" || maxProducts === "") {
      updateData.maxProducts = null
    } else if (typeof maxProducts === "number") {
      updateData.maxProducts = maxProducts
    } else if (typeof maxProducts === "string") {
      const n = parseInt(maxProducts, 10)
      if (!isNaN(n)) updateData.maxProducts = n
    }
    if (maxOrders === null || maxOrders === "unlimited" || maxOrders === "") {
      updateData.maxOrders = null
    } else if (typeof maxOrders === "number") {
      updateData.maxOrders = maxOrders
    } else if (typeof maxOrders === "string") {
      const n = parseInt(maxOrders, 10)
      if (!isNaN(n)) updateData.maxOrders = n
    }
    if (features !== undefined) updateData.features = features

    const plan = await prisma.plan.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, plan })
  } catch (error: unknown) {
    console.error("Error updating plan:", error)
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    )
  }
}

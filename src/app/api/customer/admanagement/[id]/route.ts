import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isCustomer(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const ad = await prisma.sellerAd.findFirst({
    where: { id, customerUserId: session.user.id },
    include: {
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
  if (!session?.user || !isCustomer(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const ad = await prisma.sellerAd.findFirst({
    where: { id, customerUserId: session.user.id },
  })

  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { status } = body as { status?: string }

  if (status === "PAUSED" && ad.status === "ACTIVE") {
    await prisma.sellerAd.update({
      where: { id },
      data: { status: "PAUSED" },
    })
    return NextResponse.json({ success: true, status: "PAUSED" })
  }

  if (status === "ACTIVE" && ad.status === "PAUSED") {
    await prisma.sellerAd.update({
      where: { id },
      data: { status: "ACTIVE" },
    })
    return NextResponse.json({ success: true, status: "ACTIVE" })
  }

  return NextResponse.json({ error: "Invalid status change" }, { status: 400 })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isCustomer(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const ad = await prisma.sellerAd.findFirst({ where: { id, customerUserId: session.user.id } })
  if (!ad) return NextResponse.json({ error: "Ad not found" }, { status: 404 })
  await prisma.sellerAd.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

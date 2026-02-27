import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET most recent ACTIVE ad for a given product. Used as sponsored banner on product detail page. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const now = new Date()

  const ad = await prisma.sellerAd.findFirst({
    where: {
      status: "ACTIVE",
      productId: id,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    select: {
      id: true,
      title: true,
      creativeType: true,
      creativeUrl: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(ad ?? null)
}


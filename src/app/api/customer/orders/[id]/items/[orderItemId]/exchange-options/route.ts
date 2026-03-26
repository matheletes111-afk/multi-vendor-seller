import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import {
  computeExchangePriceAdjustment,
  computeProductVariantLineTotals,
  originalOrderItemLineTotalInclGst,
  roundMoney,
} from "@/lib/exchange-pricing"

/** GET — list other variants of the same product for exchange picker. CUSTOMER only. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.CUSTOMER) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: orderId, orderItemId } = await params

  const item = await prisma.orderItem.findFirst({
    where: {
      id: orderItemId,
      orderId,
      order: { customerId: session.user.id },
      productId: { not: null },
    },
    select: {
      productNameSnapshot: true,
      productId: true,
      productVariantId: true,
      quantity: true,
      subtotal: true,
      subtotalInclGst: true,
      gstAmount: true,
      productVariant: {
        select: {
          id: true,
          name: true,
          images: true,
          attributes: true,
          replacementAllowed: true,
          returnType: true,
          returnDays: true,
        },
      },
    },
  })

  if (!item?.productId || !item.productVariantId) {
    return NextResponse.json({ error: "Order item not found" }, { status: 404 })
  }

  const v = item.productVariant
  if (!v || v.returnType !== "RETURNABLE" || !v.replacementAllowed || (v.returnDays ?? 0) <= 0) {
    return NextResponse.json({ error: "Exchange is not available for this item" }, { status: 400 })
  }

  function firstImageUrl(images: unknown): string | null {
    if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") return images[0]
    return null
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      productId: item.productId,
      id: { not: item.productVariantId },
    },
    select: {
      id: true,
      name: true,
      price: true,
      discount: true,
      hasGst: true,
      stock: true,
      attributes: true,
      images: true,
    },
    orderBy: { name: "asc" },
  })

  const oldIncl = originalOrderItemLineTotalInclGst(item)

  return NextResponse.json({
    originalLineTotalInclGst: roundMoney(oldIncl),
    productName: item.productNameSnapshot ?? null,
    currentVariant: {
      id: v.id,
      name: v.name,
      imageUrl: firstImageUrl(v.images),
      attributes: v.attributes,
    },
    variants: variants.map((row) => {
      const newTotals = computeProductVariantLineTotals(row, item.quantity)
      const adj = computeExchangePriceAdjustment(oldIncl, newTotals.totalPriceInclGst)
      return {
        id: row.id,
        name: row.name,
        price: row.price,
        discount: row.discount,
        stock: row.stock,
        attributes: row.attributes,
        imageUrl: firstImageUrl(row.images),
        eligible: row.stock >= item.quantity,
        replacementLineTotalInclGst: roundMoney(newTotals.totalPriceInclGst),
        priceDifferenceTopUp: roundMoney(adj.exchangeTopUpAmount),
        priceDifferenceWalletCredit: roundMoney(adj.exchangeRefundDifferenceAmount),
      }
    }),
  })
}

import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import {
  computeExchangePriceAdjustment,
  computeProductVariantLineTotals,
  originalOrderItemLineTotalInclGst,
  roundMoney,
} from "@/lib/exchange-pricing"

export const dynamic = "force-dynamic"

/** GET /mobileapi/customer/orders/products/details/[id]/items/[orderItemId]/exchange-options
 * List other variants of the same product for exchange picker. CUSTOMER only.
 * Auth: Bearer token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  try {
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
    }

    const { id: orderId, orderItemId } = await params

    const item = await prisma.orderItem.findFirst({
      where: {
        id: orderItemId,
        orderId,
        order: { customerId: auth.userId },
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
      return NextResponse.json({ success: false, error: "Order item not found" }, { status: 404 })
    }

    const v = item.productVariant
    if (!v || v.returnType !== "RETURNABLE" || !v.replacementAllowed || (v.returnDays ?? 0) <= 0) {
      return NextResponse.json({ success: false, error: "Exchange is not available for this item" }, { status: 400 })
    }

    function firstImageUrl(images: unknown): string | null {
      if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") return images[0]
      if (typeof images === "string") return images
      try {
        const parsed = typeof images === "string" ? JSON.parse(images) : images
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") return parsed[0]
      } catch {
        /* ignore */
      }
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

    const responseData = {
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
    }

    return NextResponse.json({ success: true, message: "Exchange options fetched", data: responseData })
  } catch (error) {
    console.error("Mobile customer exchange options error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

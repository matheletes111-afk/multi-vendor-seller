import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"

/**
 * One-off migration: ensure every product has at least one variant.
 * Creates a "Default" variant (price 0, stock 0) for any product that has none.
 * Admin only. Safe to run with current schema (no product-level price columns).
 *
 * POST /api/admin/migrate-product-variants
 */
export async function POST() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    select: { id: true, variants: { select: { id: true } } },
  })

  let created = 0
  for (const product of products) {
    if (product.variants.length === 0) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: "Default",
          price: 0,
          discount: 0,
          hasGst: true,
          stock: 0,
          attributes: {},
        },
      })
      created++
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    message: `Created ${created} default variant(s) for products that had none.`,
  })
}

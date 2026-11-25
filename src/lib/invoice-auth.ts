import type { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin, isProductSeller, isServiceSeller } from "@/lib/rbac"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { parseInvoiceQrInput, verifyInvoiceQrToken } from "@/lib/invoice-qr"
import {
  formatOrderToInvoices,
  INVOICE_ORDER_INCLUDE,
  sanitizeInvoicesForPublicQr,
  type InvoiceOrderRecord,
} from "@/lib/order-invoice"
import type { InvoiceData } from "@/lib/invoice-types"

export type InvoiceActor =
  | { kind: "ADMIN"; userId: string }
  | { kind: "CUSTOMER"; userId: string }
  | { kind: "SELLER"; userId: string; sellerId: string }
  | { kind: "RIDER"; userId: string; riderId: string }

/**
 * Resolves the authenticated actor from either NextAuth web session cookies
 * or a mobile `Authorization: Bearer <token>` header.
 */
export async function resolveInvoiceActor(request: NextRequest): Promise<InvoiceActor | null> {
  const session = await auth()
  if (session?.user?.id) {
    if (isAdmin(session.user)) {
      return { kind: "ADMIN", userId: session.user.id }
    }
    if (isProductSeller(session.user) || isServiceSeller(session.user)) {
      const seller = await prisma.seller.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (seller) {
        return { kind: "SELLER", userId: session.user.id, sellerId: seller.id }
      }
    }
    if (session.user.role === UserRole.CUSTOMER) {
      return { kind: "CUSTOMER", userId: session.user.id }
    }
    if (session.user.role === UserRole.RIDER) {
      const rider = await prisma.rider.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (rider) {
        return { kind: "RIDER", userId: session.user.id, riderId: rider.id }
      }
    }
  }

  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.slice(7).trim()
  const payload = verifyMobileAccessToken(token)
  if (!payload || !payload.userId) return null

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      role: true,
      password: true,
      seller: { select: { id: true } },
      rider: { select: { id: true } },
    },
  })
  if (!dbUser) return null

  const tokenHasPassword = payload.passwordHash != null
  const dbHasPassword = dbUser.password != null
  if (
    (tokenHasPassword && dbUser.password !== payload.passwordHash) ||
    (dbHasPassword && dbUser.password !== payload.passwordHash)
  ) {
    return null
  }

  if (dbUser.role === UserRole.ADMIN) {
    return { kind: "ADMIN", userId: dbUser.id }
  }
  if (
    (dbUser.role === UserRole.SELLER_PRODUCT || dbUser.role === UserRole.SELLER_SERVICE) &&
    dbUser.seller
  ) {
    return { kind: "SELLER", userId: dbUser.id, sellerId: dbUser.seller.id }
  }
  if (dbUser.role === UserRole.CUSTOMER) {
    return { kind: "CUSTOMER", userId: dbUser.id }
  }
  if (dbUser.role === UserRole.RIDER && dbUser.rider) {
    return { kind: "RIDER", userId: dbUser.id, riderId: dbUser.rider.id }
  }

  return null
}

/**
 * Checks whether an authenticated actor can view an order's invoices, and returns
 * any seller-scoping filter required for sellers.
 */
export async function authorizeActorForOrder(
  actor: InvoiceActor,
  order: Pick<InvoiceOrderRecord, "id" | "customerId" | "sellerId" | "items">
): Promise<{ allowed: boolean; allowedSellerId: string | null }> {
  if (actor.kind === "ADMIN") {
    return { allowed: true, allowedSellerId: null }
  }
  if (actor.kind === "CUSTOMER") {
    return { allowed: order.customerId === actor.userId, allowedSellerId: null }
  }
  if (actor.kind === "SELLER") {
    const ownsAnyItem =
      order.sellerId === actor.sellerId ||
      order.items.some((it) => it.sellerId === actor.sellerId)
    return { allowed: ownsAnyItem, allowedSellerId: actor.sellerId }
  }
  if (actor.kind === "RIDER") {
    const assignment = await prisma.riderDeliveryAssignment.findFirst({
      where: { orderId: order.id, riderId: actor.riderId },
      select: { id: true },
    })
    return { allowed: Boolean(assignment), allowedSellerId: null }
  }
  return { allowed: false, allowedSellerId: null }
}

export type VerifyQrResult =
  | {
      ok: true
      verificationMode: "SIGNED_TOKEN" | "AUTHENTICATED_LOOKUP"
      isPublicMasked: boolean
      order: InvoiceOrderRecord
      invoices: InvoiceData[]
    }
  | {
      ok: false
      status: number
      error: string
    }

/**
 * Verifies any scanned invoice QR code (signed URL, signed token, legacy text, JSON, or order number)
 * and returns complete structured invoice data.
 */
export async function verifyQrAndFetchInvoiceData(params: {
  rawQrInput: string
  actor: InvoiceActor | null
  requestOrigin?: string | null
  pdfBasePath?: string
}): Promise<VerifyQrResult> {
  const { rawQrInput, actor, requestOrigin, pdfBasePath } = params
  const parsed = parseInvoiceQrInput(rawQrInput)
  if (parsed.kind === "INVALID") {
    return { ok: false, status: 400, error: parsed.error }
  }

  if (parsed.kind === "SIGNED_TOKEN") {
    const tokenRes = verifyInvoiceQrToken(parsed.token)
    if (!tokenRes.valid) {
      return { ok: false, status: 400, error: tokenRes.error }
    }

    const order = await prisma.order.findFirst({
      where: { id: tokenRes.orderId, orderNumber: tokenRes.orderNumber },
      include: INVOICE_ORDER_INCLUDE,
    })
    if (!order) {
      return { ok: false, status: 404, error: "Order for this invoice was not found" }
    }

    let hasFullAccess = false
    let allowedSellerId: string | null = null
    if (actor) {
      const authz = await authorizeActorForOrder(actor, order)
      hasFullAccess = authz.allowed
      allowedSellerId = authz.allowedSellerId
    }

    const rawInvoices = await formatOrderToInvoices(order, {
      allowedSellerId,
      filterSellerId: tokenRes.sellerId,
      baseUrl: requestOrigin,
      pdfBasePath: pdfBasePath ?? `/api/orders/${order.id}/invoice/pdf`,
    })

    if (rawInvoices.length === 0) {
      return { ok: false, status: 404, error: "No matching seller invoice found for this QR code" }
    }

    const invoices = hasFullAccess ? rawInvoices : sanitizeInvoicesForPublicQr(rawInvoices)
    return {
      ok: true,
      verificationMode: "SIGNED_TOKEN",
      isPublicMasked: !hasFullAccess,
      order,
      invoices,
    }
  }

  // Unsigned lookup by orderNumber or orderId requires an authorized actor
  if (!actor) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required to look up an order without a signed QR verification token.",
    }
  }

  let order =
    parsed.kind === "ORDER_ID"
      ? await prisma.order.findUnique({
          where: { id: parsed.orderId },
          include: INVOICE_ORDER_INCLUDE,
        })
      : await prisma.order.findFirst({
          where: { orderNumber: { equals: parsed.orderNumber, mode: "insensitive" } },
          include: INVOICE_ORDER_INCLUDE,
        })

  if (!order && parsed.kind === "ORDER_NUMBER") {
    const suffixMatch = parsed.orderNumber.match(/^(.+)-\d+$/)
    if (suffixMatch?.[1]) {
      order = await prisma.order.findFirst({
        where: { orderNumber: { equals: suffixMatch[1], mode: "insensitive" } },
        include: INVOICE_ORDER_INCLUDE,
      })
    }
  }

  if (!order) {
    return { ok: false, status: 404, error: "Order not found for scanned QR code" }
  }

  const authz = await authorizeActorForOrder(actor, order)
  if (!authz.allowed) {
    return { ok: false, status: 403, error: "You do not have permission to access this order's invoice" }
  }

  const invoices = await formatOrderToInvoices(order, {
    allowedSellerId: authz.allowedSellerId,
    baseUrl: requestOrigin,
    pdfBasePath: pdfBasePath ?? `/api/orders/${order.id}/invoice/pdf`,
  })

  if (invoices.length === 0) {
    return { ok: false, status: 404, error: "No invoice items available" }
  }

  return {
    ok: true,
    verificationMode: "AUTHENTICATED_LOOKUP",
    isPublicMasked: false,
    order,
    invoices,
  }
}

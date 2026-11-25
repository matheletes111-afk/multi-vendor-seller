import { PublicLayout } from "@/components/site-layout"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin, isProductSeller, isServiceSeller } from "@/lib/rbac"
import { UserRole } from "@prisma/client"
import { verifyQrAndFetchInvoiceData, type InvoiceActor } from "@/lib/invoice-auth"
import { InvoiceVerifyClient, type VerifyResponseData } from "./verify-client"

export const dynamic = "force-dynamic"

async function resolveServerSessionActor(): Promise<InvoiceActor | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  if (isAdmin(session.user)) return { kind: "ADMIN", userId: session.user.id }
  if (isProductSeller(session.user) || isServiceSeller(session.user)) {
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (seller) return { kind: "SELLER", userId: session.user.id, sellerId: seller.id }
  }
  if (session.user.role === UserRole.CUSTOMER) {
    return { kind: "CUSTOMER", userId: session.user.id }
  }
  return null
}

export default async function InvoiceVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; token?: string; qr?: string; code?: string }>
}) {
  const sp = await searchParams
  const rawQrInput = (sp.t || sp.token || sp.qr || sp.code || "").trim()

  let initialResult: VerifyResponseData | null = null
  let initialError: string | null = null

  if (rawQrInput) {
    const actor = await resolveServerSessionActor()
    const res = await verifyQrAndFetchInvoiceData({
      rawQrInput,
      actor,
    })

    if (res.ok) {
      initialResult = {
        success: true,
        verified: true,
        verificationMode: res.verificationMode,
        isPublicMasked: res.isPublicMasked,
        orderId: res.order.id,
        orderNumber: res.order.orderNumber,
        invoiceCount: res.invoices.length,
        invoice: res.invoices[0],
        invoices: res.invoices,
      }
    } else {
      initialError = res.error
    }
  }

  return (
    <PublicLayout>
      <InvoiceVerifyClient
        initialInput={rawQrInput}
        initialResult={initialResult}
        initialError={initialError}
      />
    </PublicLayout>
  )
}

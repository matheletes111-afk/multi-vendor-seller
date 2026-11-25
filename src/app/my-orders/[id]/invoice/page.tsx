import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isCustomer } from "@/lib/rbac"
import { OrderInvoicePageClient } from "@/components/order/order-invoice-page-client"

export default async function MyOrderInvoicePage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sellerId?: string }>
}) {
  const session = await auth()
  if (!session?.user || !isCustomer(session.user)) {
    redirect("/customer/login")
  }

  const params = await props.params
  const searchParams = await props.searchParams

  return (
    <OrderInvoicePageClient
      orderId={params.id}
      sellerId={searchParams.sellerId}
      backUrl="/my-orders"
    />
  )
}

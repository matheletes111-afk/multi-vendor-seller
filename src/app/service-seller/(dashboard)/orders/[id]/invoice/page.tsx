import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { OrderInvoicePageClient } from "@/components/order/order-invoice-page-client"

export default async function ServiceSellerOrderInvoicePage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sellerId?: string }>
}) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/service-seller/login")
  }
  
  const params = await props.params
  const searchParams = await props.searchParams

  return (
    <OrderInvoicePageClient 
      orderId={params.id} 
      sellerId={searchParams.sellerId}
      backUrl={`/service-seller/orders/${params.id}`} 
    />
  )
}

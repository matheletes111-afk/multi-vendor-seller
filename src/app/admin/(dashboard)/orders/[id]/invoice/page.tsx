import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { OrderInvoicePageClient } from "@/components/order/order-invoice-page-client"

export default async function AdminOrderInvoicePage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sellerId?: string }>
}) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  
  const params = await props.params
  const searchParams = await props.searchParams

  return (
    <OrderInvoicePageClient 
      orderId={params.id} 
      sellerId={searchParams.sellerId}
      backUrl={`/admin/orders/${params.id}`} 
    />
  )
}

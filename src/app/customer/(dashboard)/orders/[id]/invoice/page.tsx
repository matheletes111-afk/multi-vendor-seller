import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { OrderInvoicePageClient } from "@/components/order/order-invoice-page-client"

export default async function CustomerOrderInvoicePage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sellerId?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "CUSTOMER") {
    redirect("/login")
  }
  
  const params = await props.params
  const searchParams = await props.searchParams

  return (
    <OrderInvoicePageClient 
      orderId={params.id} 
      sellerId={searchParams.sellerId}
      backUrl={`/customer/orders/${params.id}`} 
    />
  )
}

import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { OrderInvoicePageClient } from "@/components/order/order-invoice-page-client"

export default async function ProductSellerOrderInvoicePage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sellerId?: string }>
}) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/product-seller/login")
  }
  
  const params = await props.params
  const searchParams = await props.searchParams

  return (
    <OrderInvoicePageClient 
      orderId={params.id} 
      sellerId={searchParams.sellerId}
      backUrl={`/product-seller/orders/${params.id}`} 
    />
  )
}

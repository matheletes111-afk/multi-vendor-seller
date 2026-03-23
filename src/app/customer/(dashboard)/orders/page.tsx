import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { OrdersListClient } from "./orders-list-client"
import { PageLoader } from "@/components/ui/page-loader"

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user) return null

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Orders</h1>
        <p className="text-muted-foreground mt-1">
          View and track your order history. Switch between product and service orders.
        </p>
      </div>

      <Suspense fallback={<PageLoader variant="listing" message="Loading orders…" />}>
        <OrdersListClient />
      </Suspense>
    </div>
  )
}

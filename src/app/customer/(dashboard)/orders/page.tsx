import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { OrdersListClient } from "./orders-list-client"
import { PageLoader } from "@/components/ui/page-loader"

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user) return null

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 font-sans antialiased">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[24px]">
          My Orders
          <span className="mt-2 block h-1 w-14 rounded-full bg-blue-600" aria-hidden />
        </h1>
        <p className="mt-3 text-sm text-gray-600 sm:text-base">
          View and track your order history. Switch between product and service orders.
        </p>
      </div>

      <Suspense fallback={<PageLoader variant="listing" message="Loading orders…" />}>
        <OrdersListClient />
      </Suspense>
    </div>
  )
}

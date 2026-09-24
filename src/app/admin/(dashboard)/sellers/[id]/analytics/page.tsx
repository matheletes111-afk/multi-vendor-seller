import { Suspense } from "react"
import { PageLoader } from "@/components/ui/page-loader"
import { SellerAnalyticsClient } from "./seller-analytics-client"

interface SellerAnalyticsPageProps {
  params: Promise<{
    id: string
  }>
  searchParams?: Promise<{
    sellerType?: string
  }>
}

export default async function SellerAnalyticsPage({ params, searchParams }: SellerAnalyticsPageProps) {
  const { id } = await params
  const sp = searchParams ? await searchParams : {}

  return (
    <Suspense fallback={<PageLoader />}>
      <SellerAnalyticsClient id={id} initialSellerType={sp.sellerType} />
    </Suspense>
  )
}

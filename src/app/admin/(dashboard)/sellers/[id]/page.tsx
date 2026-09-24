import { Suspense } from "react"
import { PageLoader } from "@/components/ui/page-loader"
import { SellerIdClient } from "./seller-id-client"

interface SellerDetailsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SellerDetailsPage({ params }: SellerDetailsPageProps) {
  const { id } = await params
  
  return (
    <Suspense fallback={<PageLoader />}>
      <SellerIdClient id={id} />
    </Suspense>
  )
}

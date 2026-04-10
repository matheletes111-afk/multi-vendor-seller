import { SellerIdClient } from "./seller-id-client"

interface SellerDetailsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SellerDetailsPage({ params }: SellerDetailsPageProps) {
  const { id } = await params
  
  return (
    <SellerIdClient id={id} />
  )
}

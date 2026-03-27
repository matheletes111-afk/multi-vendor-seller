import { WalletTransactionDetailClient } from "./wallet-transaction-detail-client"

export default async function WalletTransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WalletTransactionDetailClient transactionId={id} />
}

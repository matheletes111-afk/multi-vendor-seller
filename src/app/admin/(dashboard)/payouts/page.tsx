import { Metadata } from "next"
import { AdminPayoutsClient } from "./payouts-client"

export const metadata: Metadata = {
  title: "Seller Payouts & Liabilities | Admin Dashboard",
  description: "Reconcile vendor balances, manage payout requests, and record manual fund disbursements.",
}

export default function AdminPayoutsPage() {
  return <AdminPayoutsClient />
}


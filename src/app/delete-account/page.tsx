import { Metadata } from "next"
import { PublicLayout } from "@/components/site-layout"
import { DeleteAccountSinglePageClient } from "./delete-account-client"

export const metadata: Metadata = {
  title: "MEEEM Seller App – Account & Data Deletion Request",
  description: "Official account and data deletion request instructions and policy for MEEEM E-commerce Ltd.",
}

export default function DeleteAccountPage() {
  return (
    <PublicLayout>
      <DeleteAccountSinglePageClient />
    </PublicLayout>
  )
}

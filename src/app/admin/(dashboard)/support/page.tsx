import { Metadata } from "next"
import { AdminSupportListClient } from "./support-list-client"

export const metadata: Metadata = {
  title: "Support Tickets | Admin Portal",
  description: "Manage and reply to customer and seller support inquiries and tickets.",
}

export default function AdminSupportPage() {
  return <AdminSupportListClient />
}

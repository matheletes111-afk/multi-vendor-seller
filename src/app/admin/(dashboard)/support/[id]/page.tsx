import { Metadata } from "next"
import AdminSupportDetailClient from "./support-detail-client"

export const metadata: Metadata = {
  title: "Support Ticket Details & Reply | Admin Portal",
  description: "View ticket conversation, send email reply, and manage ticket status.",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminSupportDetailPage({ params }: PageProps) {
  const { id } = await params
  return <AdminSupportDetailClient ticketIdOrDbId={id} />
}

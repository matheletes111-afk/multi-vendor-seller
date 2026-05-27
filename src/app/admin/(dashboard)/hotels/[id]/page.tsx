import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { HotelDetailsClient } from "./hotel-details-client"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminHotelDetailsPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  
  const resolvedParams = await params;
  return <HotelDetailsClient id={resolvedParams.id} />
}

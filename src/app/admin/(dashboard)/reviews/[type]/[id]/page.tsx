import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AdminReviewDetailsClient } from "./review-details-client"

export default async function AdminReviewDetailsPage({
  params,
}: {
  params: Promise<{ type: "product" | "service"; id: string }>
}) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  const { type, id } = await params
  return <AdminReviewDetailsClient type={type} id={id} />
}


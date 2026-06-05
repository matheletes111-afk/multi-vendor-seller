import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { EditServiceClient } from "./edit-service-client"

export default async function AdminEditServicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  const { id } = await params
  return <EditServiceClient serviceId={id} />
}

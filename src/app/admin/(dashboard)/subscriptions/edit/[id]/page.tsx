import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { EditPlanClient } from "./edit-plan-client"

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  const { id } = await params
  return (
    <div className="container mx-auto py-8">
      <EditPlanClient planId={id} />
    </div>
  )
}

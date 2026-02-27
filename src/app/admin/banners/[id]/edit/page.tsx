import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { EditBannerClient } from "./edit-banner-client"

export default async function EditBannerPage({
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
    <div className="container mx-auto p-6">
      <EditBannerClient bannerId={id} />
    </div>
  )
}

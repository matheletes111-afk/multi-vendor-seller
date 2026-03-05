import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { EditCategoryClient } from "./edit-category-client"

export default async function EditCategoryPage({
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
    <div className="container mx-auto p-6 min-h-full bg-background text-foreground">
      <EditCategoryClient categoryId={id} />
    </div>
  )
}

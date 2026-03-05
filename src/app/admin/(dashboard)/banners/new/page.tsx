import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { NewBannerClient } from "./new-banner-client"

export default async function NewBannerPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  return (
    <div className="container mx-auto p-6">
      <NewBannerClient />
    </div>
  )
}

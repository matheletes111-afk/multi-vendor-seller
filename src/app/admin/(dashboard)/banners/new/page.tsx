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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <NewBannerClient />
    </div>
  )
}

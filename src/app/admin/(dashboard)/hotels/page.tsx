import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { HotelsClient } from "./hotels-client"

export default async function AdminHotelsPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-slate-400 text-sm font-semibold">Loading hotels...</div>}>
      <HotelsClient />
    </Suspense>
  )
}

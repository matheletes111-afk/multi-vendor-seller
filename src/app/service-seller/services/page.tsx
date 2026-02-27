import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ServicesPageClient } from "./page-client"

export default async function ServicesPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login")
  return <ServicesPageClient />
}

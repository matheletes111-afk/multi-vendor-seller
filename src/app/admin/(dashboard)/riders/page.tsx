import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { RidersClient } from "./riders-client"

export const metadata = {
  title: "Delivery Riders Management | Admin Portal",
  description: "Manage delivery riders, create rider accounts, inspect KYC documents, and configure zonal delivery areas.",
}

export default async function AdminRidersPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  return <RidersClient />
}

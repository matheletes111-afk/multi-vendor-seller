import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { NewAdClient } from "./new-ad-client"

export default async function NewAdPage() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) redirect("/login")
  return <NewAdClient />
}

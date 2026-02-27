import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isServiceSeller } from "@/lib/rbac"
import { ServiceSellerLayoutClient } from "./layout-client"

export default async function ServiceSellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/dashboard")
  return (
    <ServiceSellerLayoutClient
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
    >
      {children}
    </ServiceSellerLayoutClient>
  )
}

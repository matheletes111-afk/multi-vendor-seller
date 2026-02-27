import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isProductSeller } from "@/lib/rbac"
import { ProductSellerLayoutClient } from "./layout-client"

export default async function ProductSellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/dashboard")
  }

  return (
    <ProductSellerLayoutClient
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
    >
      {children}
    </ProductSellerLayoutClient>
  )
}

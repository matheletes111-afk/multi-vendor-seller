import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isProductSeller } from "@/lib/rbac"
import { ProductSellerLayoutClient } from "../layout-client"

export default async function ProductSellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) redirect("/product-seller/login")
  if (!isProductSeller(session.user)) redirect("/dashboard")

  const u = session.user as { onboardingCompleted?: boolean }
  if (u.onboardingCompleted !== true) {
    redirect("/product-seller/onboarding")
  }

  return (
    <ProductSellerLayoutClient
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        phone: session.user.phone ?? null,
        image: session.user.image ?? null,
      }}
    >
      {children}
    </ProductSellerLayoutClient>
  )
}

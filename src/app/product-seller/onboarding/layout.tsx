import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isProductSeller } from "@/lib/rbac"
import { ProductSellerLayoutClient } from "../layout-client"

/** Onboarding lives outside `(dashboard)` so the dashboard layout’s onboarding redirect cannot loop when `x-current-path` is missing from RSC requests. */
export default async function ProductSellerOnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) redirect("/product-seller/login")
  if (!isProductSeller(session.user)) redirect("/dashboard")

  const u = session.user as { isSuspended?: boolean }
  if (u.isSuspended === true) {
    redirect("/product-seller/login?error=AccountSuspended")
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

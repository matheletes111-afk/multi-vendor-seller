import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isProductSeller } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
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

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    redirect("/register")
  }

  if (seller.type !== "PRODUCT") {
    redirect("/service-seller")
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

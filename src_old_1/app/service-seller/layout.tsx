import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isServiceSeller } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { ServiceSellerLayoutClient } from "./layout-client"

export default async function ServiceSellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/dashboard")
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    redirect("/register")
  }

  if (seller.type !== "SERVICE") {
    redirect("/product-seller")
  }

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

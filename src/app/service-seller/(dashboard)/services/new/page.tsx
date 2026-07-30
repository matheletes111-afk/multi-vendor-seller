import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { NewServiceClient } from "./new-service-client"

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/service-seller/login")
  }

  const params = await searchParams
  const sellerWithCats = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: {
      selectedServiceCategories: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
    },
  })
  const categories = sellerWithCats?.selectedServiceCategories || []

  return <NewServiceClient categories={categories} initialError={params.error} />
}

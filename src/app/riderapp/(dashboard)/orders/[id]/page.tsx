import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderOrderDeliveryClient } from "./order-delivery-client"

export const metadata = {
  title: "Live Order Delivery | Rider Portal",
  description: "Manage pickup, navigation, customer drop-off, and OTP confirmation.",
}

export default async function RiderOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "RIDER") {
    redirect("/riderapp/login")
  }

  const { id } = await params

  return <RiderOrderDeliveryClient assignmentId={id} />
}

import { ReactNode } from "react"
import { auth } from "@/lib/auth"
import { RiderLayoutClient } from "./layout-client"

export const metadata = {
  title: "Rider Portal | MEEEM Delivery Network",
  description: "Delivery Rider portal for MEEEM Marketplace logistics.",
}

export default async function RiderLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  return (
    <RiderLayoutClient user={session?.user || null}>
      {children}
    </RiderLayoutClient>
  )
}

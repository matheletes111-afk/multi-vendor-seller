import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderSettingsClient } from "./settings-client"

export const metadata = {
  title: "Rider Settings | MEEEM Delivery Network",
  description: "Update your rider profile, vehicle information, verification documents, delivery zones, and password.",
}

export default async function RiderSettingsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "RIDER") {
    redirect("/riderapp/login")
  }

  return <RiderSettingsClient user={session.user} />
}

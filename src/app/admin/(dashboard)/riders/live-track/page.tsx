import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { LiveTrackClient } from "./live-track-client"

export const metadata = {
  title: "Live Rider Tracking | Admin Portal",
  description: "Live map and location tracking for delivery riders and active orders.",
}

export default async function AdminLiveTrackPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  return <LiveTrackClient />
}

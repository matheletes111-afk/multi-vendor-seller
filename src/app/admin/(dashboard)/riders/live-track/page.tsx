import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { LiveTrackClient } from "./live-track-client"

export const metadata = {
  title: "Live Rider Fleet Tracking | Admin Portal",
  description: "Real-time GPS tracking and monitoring of delivery riders, active routes, and zonal fleet operations.",
}

export default async function AdminLiveTrackPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  return <LiveTrackClient />
}

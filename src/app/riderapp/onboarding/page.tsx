import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderOnboardingClient } from "./onboarding-client"

export const metadata = {
  title: "Rider Onboarding | MEEEM Delivery Network",
  description: "Complete your first-time rider onboarding setup, upload verification documents, and configure your active delivery zones.",
}

export default async function RiderOnboardingPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "RIDER") {
    redirect("/riderapp/login")
  }

  const u = session.user as { onboardingCompleted?: boolean; isFirstLogin?: boolean }
  if (u.onboardingCompleted && !u.isFirstLogin) {
    redirect("/riderapp")
  }

  return <RiderOnboardingClient user={session.user} />
}

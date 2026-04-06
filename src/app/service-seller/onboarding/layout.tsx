import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isServiceSeller } from "@/lib/rbac"

/** Onboarding lives outside `(dashboard)` so the dashboard layout’s onboarding redirect cannot loop when `x-current-path` is missing from RSC requests. */
export default async function ServiceSellerOnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) redirect("/service-seller/login")
  if (!isServiceSeller(session.user)) redirect("/dashboard")

  const u = session.user as { isSuspended?: boolean }
  if (u.isSuspended === true) {
    redirect("/service-seller/login?error=AccountSuspended")
  }

  return (
    <div className="min-h-screen bg-[#F0F9F8]">
      {children}
    </div>
  )
}

import { Suspense } from "react"
import { RiderVerifyEmailClient } from "./verify-email-client"

export const metadata = {
  title: "Verify Email | MEEEM Rider Portal",
  description: "Verify your email to activate your delivery rider account.",
}

export default function RiderVerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RiderVerifyEmailClient />
    </Suspense>
  )
}

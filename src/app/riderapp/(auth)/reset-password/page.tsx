import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderResetPasswordClient } from "./reset-password-client"

export const metadata = {
  title: "Reset Password | Rider Portal",
  description: "Set a new password for your delivery rider account.",
}

export default async function RiderResetPasswordPage() {
  const session = await auth()
  if (session?.user?.role === "RIDER") {
    redirect("/riderapp")
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="text-xs text-muted-foreground animate-pulse">Loading...</div>
        </div>
      }
    >
      <RiderResetPasswordClient />
    </Suspense>
  )
}

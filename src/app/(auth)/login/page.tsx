import { Suspense } from "react"
import { LoginFormClient } from "./login-form-client"

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginFormClient />
    </Suspense>
  )
}

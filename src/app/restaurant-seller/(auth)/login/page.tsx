"use client"

import { Suspense, useState, useEffect } from "react"
import { getCsrfToken, signIn, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { getSafeRedirectUrl } from "@/lib/safe-redirect"


function RestaurantSellerLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = getSafeRedirectUrl(searchParams.get("callbackUrl"), "/restaurant-seller")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  // Handle URL search param errors/success (e.g. redirected back from dashboard middleware)
  useEffect(() => {
    const err = searchParams.get("error")
    const verified = searchParams.get("verified")
    const reset = searchParams.get("reset")
    const registered = searchParams.get("registered")

    if (verified === "1") {
      setSuccess("Email verified successfully! You can now log in.")
    } else if (reset === "1") {
      setSuccess("Password reset successfully. You can now log in with your new password.")
    } else if (registered === "true") {
      setSuccess("Registration successful! Please check your email to verify your account before signing in.")
    }

    if (err === "AccountPendingOrSuspended") {
      setError("Your account is pending approval or has been suspended. Please contact support.")
    } else if (err === "NoSellerAccount") {
      setError("You do not have a restaurant seller account for this email. Please register or use a different email.")
    } else if (err === "session_expired") {
      setError("Your session has expired. Please sign in again.")
    } else if (err === "CredentialsSignin") {
      setError("Invalid email or password. Please try again.")
    } else if (err && err !== "undefined") {
      setError(decodeURIComponent(err))
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const res = await fetch("/api/restaurant-seller/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          callbackUrl,
          csrfToken: csrfToken ?? undefined,
        }),
        credentials: "include",
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        if (data?.url && data.url.includes("error=")) {
          setError(data.error || "Invalid email or password.")
          return
        }
        window.location.href = getSafeRedirectUrl(data?.url || callbackUrl, "/restaurant-seller")
        return
      }

      if (res.status === 403 && data.needsVerification && data.verifyUrl) {
        router.push(data.verifyUrl)
        return
      }

      // Surface specific errors from the API
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        setError(data.error || "Invalid email or password.")
      } else if (res.status === 500) {
        setError("A server error occurred. Please try again in a moment.")
      } else {
        setError(data.error || "Login failed. Please check your credentials and try again.")
      }
    } catch {
      setError("Network error. Please check your internet connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">
      <div className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <a href="/">
            <Image src="/images/logo.png" alt="Logo" width={180} height={48} className="h-12 w-auto object-contain" />
          </a>
        </div>
        <h1 className="text-center text-2xl font-semibold text-gray-900">Restaurant Seller Sign In</h1>
        <p className="mt-1 text-center text-sm text-gray-500">Log in to your restaurant dashboard</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {/* Success banner */}
          {success && (
            <Alert className="border-green-100 bg-green-50 text-green-800 rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Error banner */}
          {error && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input id="email" name="email" type="email" placeholder="john@restaurant.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/restaurant-seller/forgot-password" className="text-xs text-blue-600 hover:underline font-medium">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full rounded-full py-6 mt-4 text-base font-semibold shadow-lg shadow-blue-100">
            {loading ? "Logging in..." : "Log in"}
          </Button>

          <div className="mt-3 text-center">
            <Button type="button" variant="outline" asChild className="w-full rounded-full">
              <Link href={`/restaurant-seller/login/email-otp?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Login via Email OTP</Link>
            </Button>
          </div>
          <div className="mt-2 text-center">
            <Button type="button" variant="outline" asChild className="w-full rounded-full">
              <Link href={`/restaurant-seller/login/phone-otp?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Login via Number</Link>
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="rounded-full flex-1"
              disabled={loading}
              onClick={async () => {
                try {
                  const nextUrl = encodeURIComponent(callbackUrl)
                  const callbackUrlWithRole = `/api/auth/oauth-postprocess?role=SELLER_RESTAURANT&next=${nextUrl}`
                  await signOut({ redirect: false })
                  await signIn("google", { callbackUrl: callbackUrlWithRole, redirect: true })
                } catch {}
              }}
            >
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full flex-1"
              disabled={loading}
              onClick={async () => {
                try {
                  const nextUrl = encodeURIComponent(callbackUrl)
                  const callbackUrlWithRole = `/api/auth/oauth-postprocess?role=SELLER_RESTAURANT&next=${nextUrl}`
                  await signOut({ redirect: false })
                  await signIn("facebook", { callbackUrl: callbackUrlWithRole, redirect: true })
                } catch {}
              }}
            >
              Facebook
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          New to Meeem Food?{" "}
          <Link href="/restaurant-seller/registration" className="font-medium text-blue-600 hover:underline">Partner with us</Link>
        </p>
      </div>
    </div>
  )
}

export default function RestaurantSellerLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="text-gray-500">Loading...</div></div>}>
      <RestaurantSellerLoginForm />
    </Suspense>
  )
}

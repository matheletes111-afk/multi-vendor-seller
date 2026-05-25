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
import { AlertCircle, Eye, EyeOff } from "lucide-react"

function HotelSellerLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/hotel-seller"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  useEffect(() => {
    const err = searchParams.get("error")
    if (err === "AccountPendingOrSuspended") {
      setError("Your account is pending approval or has been suspended.")
    } else if (err === "NoSellerAccount") {
      setError("You do not have a hotel seller account for this email.")
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/hotel-seller/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, callbackUrl, csrfToken: csrfToken ?? undefined }),
        credentials: "include",
        redirect: "manual",
      })
      if (res.status === 302) {
        const loc = res.headers.get("Location")
        if (loc && !loc.includes("error=")) {
          window.location.href = loc
          return
        }
      }
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.url && data.url.includes("error=")) {
          setError("Invalid email or password.")
          return
        }
        window.location.href = data?.url ?? callbackUrl
        return
      }
      const data = await res.json().catch(() => ({}))
      if (res.status === 403 && data.needsVerification && data.verifyUrl) {
        router.push(data.verifyUrl)
        return
      }
      setError(data.error || "Invalid email or password.")
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden bg-gray-50/90 px-4 py-5 sm:p-4">
      <div className="w-full max-w-[440px] min-w-0 rounded-2xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6 md:p-8">
        <div className="mb-5 flex justify-center sm:mb-6">
          <a href="/">
            <Image src="/images/logo.png" alt="Logo" width={180} height={48} className="h-12 w-auto object-contain sm:h-14 sm:max-h-[70px]" />
          </a>
        </div>
        <div className="mb-6 sm:mb-8">
          <h1 className="text-left text-xl font-semibold text-gray-900 sm:text-2xl">Hotel Seller Sign In</h1>
          <p className="mt-1 text-left text-sm text-gray-500">Sign in to manage your hotels</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-5">
            <div>
              <Label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">Email</Label>
              <Input id="email" type="email" placeholder="example@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">Password</Label>
                <Link href="/hotel-seller/forgot-password" className="text-xs text-blue-600 hover:underline font-medium mb-1.5">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="**********" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200 pr-10" />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              <div className="mt-4 text-center">
                <Button type="submit" disabled={loading} className="mx-auto w-full rounded-full sm:max-w-[200px]">
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </div>
              <div className="mt-3 text-center">
                <Button type="button" variant="outline" asChild className="w-full rounded-full sm:max-w-[260px]">
                  <Link href={`/hotel-seller/login/email-otp?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Login via Email OTP</Link>
                </Button>
              </div>
              <div className="mt-2 text-center">
                <Button type="button" variant="outline" asChild className="w-full rounded-full sm:max-w-[260px]">
                  <Link href={`/hotel-seller/login/phone-otp?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Login via Number</Link>
                </Button>
              </div>
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
                className="rounded-full"
                disabled={loading}
                onClick={async () => {
                  try {
                    const nextUrl = encodeURIComponent(callbackUrl)
                    const callbackUrlWithRole = `/api/auth/oauth-postprocess?role=SELLER_HOTEL&next=${nextUrl}`
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
                className="rounded-full"
                disabled={loading}
                onClick={async () => {
                  try {
                    const nextUrl = encodeURIComponent(callbackUrl)
                    const callbackUrlWithRole = `/api/auth/oauth-postprocess?role=SELLER_HOTEL&next=${nextUrl}`
                    await signOut({ redirect: false })
                    await signIn("facebook", { callbackUrl: callbackUrlWithRole, redirect: true })
                  } catch {}
                }}
              >
                Facebook
              </Button>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account? <Link href="/hotel-seller/registration" className="font-medium text-blue-600 hover:underline">Register as Hotel Seller</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default function HotelSellerLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4"><div className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-xl text-center sm:rounded-3xl sm:p-8">Loading...</div></div>}>
      <HotelSellerLoginForm />
    </Suspense>
  )
}

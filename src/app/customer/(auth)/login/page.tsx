"use client"

import { Suspense, useState, useEffect } from "react"
import { getCsrfToken } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { AlertCircle, Eye, EyeOff } from "lucide-react"

function CustomerLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/customer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, callbackUrl, csrfToken: csrfToken ?? undefined }),
        credentials: "include",
        redirect: "manual",
      })
      if (res.status === 302) {
        const loc = res.headers.get("Location")
        if (loc && !loc.includes("error=")) {
          router.push(loc)
          router.refresh()
          return
        }
      }
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.url && data.url.includes("error=")) {
          let msg = "Invalid email or password."
          try {
            const u = new URL(data.url)
            const err = u.searchParams.get("error")
            if (err === "CredentialsSignin") msg = "Invalid email or password."
            else if (err === "MissingCSRF") msg = "Session expired. Please refresh and try again."
            else if (err) msg = err
          } catch {
            /* use default */
          }
          setError(msg)
          return
        }
        router.push(data?.url ?? callbackUrl)
        router.refresh()
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">
      <div className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <a href="/">
            <Image src="/images/logo.png" alt="Logo" width={180} height={48} className="h-[70px] w-auto object-contain" />
          </a>
        </div>
        <div className="mb-8">
          <h1 className="text-left text-2xl font-semibold text-gray-900">Sign In</h1>
          <p className="mt-1 text-left text-sm text-gray-500">Hi! Welcome back, you&apos;ve been missed</p>
        </div>
        <form onSubmit={handleSubmit}>
          {searchParams.get("verified") === "1" && (
            <Alert className="mb-5 border-green-200 bg-green-50 text-green-800">
              <AlertDescription>Email verified. You can sign in now.</AlertDescription>
            </Alert>
          )}
          {searchParams.get("registered") === "true" && !searchParams.get("verified") && (
            <Alert className="mb-5 border-blue-200 bg-blue-50 text-blue-800">
              <AlertDescription>Please check your email to verify your account before signing in.</AlertDescription>
            </Alert>
          )}
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
              <Label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="**********" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200 pr-10" />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <div className="text-center">
              <Button type="submit" disabled={loading} className="mx-auto w-full max-w-[200px] rounded-full">{loading ? "Signing in..." : "Sign In"}</Button>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account? <Link href="/customer/registration" className="font-medium text-blue-600 hover:underline">Sign Up</Link>
          </p>
          <p className="mt-4 text-center"><Link href="/" className="text-sm text-gray-500 hover:text-blue-600">Continue as a guest</Link></p>
        </form>
      </div>
    </div>
  )
}

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4"><div className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-xl text-center">Loading...</div></div>}>
      <CustomerLoginForm />
    </Suspense>
  )
}

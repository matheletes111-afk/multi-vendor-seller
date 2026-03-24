"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { getCsrfToken } from "next-auth/react"
import { AlertCircle, Mail, KeyRound } from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"

type EmailOtpLoginConfig = {
  panelTitle: string
  sendOtpApi: string
  verifyOtpApi: string
  loginApi: string
  loginPath: string
  requestPath: string
  verifyPath: string
  defaultCallbackUrl: string
}

export function EmailOtpLoginRequestForm({ config }: { config: EmailOtpLoginConfig }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || config.defaultCallbackUrl
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(config.sendOtpApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Failed to send OTP.")
        return
      }
      const q = new URLSearchParams({
        email: email.trim(),
        callbackUrl,
      })
      router.push(`${config.verifyPath}?${q.toString()}`)
    } catch {
      setError("Something went wrong. Please try again.")
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
          <h1 className="text-left text-xl font-semibold text-gray-900 sm:text-2xl">{config.panelTitle} OTP Login</h1>
          <p className="mt-1 text-left text-sm text-gray-500">Enter your email to receive login OTP.</p>
        </div>
        <form onSubmit={handleSendOtp}>
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
            <div className="text-center">
              <Button type="submit" disabled={loading} className="mx-auto w-full rounded-full sm:max-w-[240px]">
                <Mail className="mr-2 h-4 w-4" />
                {loading ? "Sending OTP..." : "Send Login OTP"}
              </Button>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600">
            <Link href={`${config.loginPath}${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-medium text-blue-600 hover:underline">
              Back to password login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export function EmailOtpLoginVerifyForm({ config }: { config: EmailOtpLoginConfig }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = (searchParams.get("email") || "").trim()
  const callbackUrl = searchParams.get("callbackUrl") || config.defaultCallbackUrl
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  const handleVerifyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email) return setError("Email is missing. Please start again.")
    if (otp.length !== 6) return setError("Enter the 6-digit OTP.")
    setLoading(true)
    try {
      const verifyRes = await fetch(config.verifyOtpApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      })
      const verifyData = await verifyRes.json().catch(() => ({}))
      if (!verifyRes.ok || !verifyData.otpLoginToken) {
        setError(verifyData.error || "Invalid or expired OTP.")
        return
      }

      const loginRes = await fetch(config.loginApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        redirect: "manual",
        body: JSON.stringify({
          email,
          otpLoginToken: verifyData.otpLoginToken,
          callbackUrl,
          csrfToken: csrfToken ?? undefined,
        }),
      })

      if (loginRes.status === 302) {
        const loc = loginRes.headers.get("Location")
        if (loc && !loc.includes("error=")) {
          window.location.href = loc
          return
        }
      }
      const loginData = await loginRes.json().catch(() => ({}))
      if (!loginRes.ok) {
        setError(loginData.error || "Login failed.")
        return
      }
      window.location.href = loginData?.url ?? callbackUrl
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    if (!email || loading) return
    setError("")
    setLoading(true)
    try {
      const res = await fetch(config.sendOtpApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || "Failed to send OTP.")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">
        <div className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-xl text-center">
          <p className="text-gray-600">Missing email. Please start from OTP login page.</p>
          <Link href={config.requestPath} className="mt-4 inline-block text-blue-600 hover:underline">Go to OTP login</Link>
        </div>
      </div>
    )
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
          <h1 className="text-left text-xl font-semibold text-gray-900 sm:text-2xl">Verify Login OTP</h1>
          <p className="mt-1 text-left text-sm text-gray-500">Enter OTP sent to {email}</p>
        </div>
        <form onSubmit={handleVerifyAndLogin}>
          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-5">
            <div>
              <Label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-gray-700">OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                disabled={loading}
                className="rounded-xl border-gray-200 text-center tracking-[0.4em]"
              />
            </div>
            <div className="text-center">
              <Button type="submit" disabled={loading} className="mx-auto w-full rounded-full sm:max-w-[240px]">
                <KeyRound className="mr-2 h-4 w-4" />
                {loading ? "Verifying..." : "Verify OTP & Login"}
              </Button>
            </div>
            <div className="text-center">
              <Button type="button" variant="outline" onClick={resendOtp} disabled={loading} className="rounded-full">
                Resend OTP
              </Button>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600">
            <Link href={`${config.loginPath}${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-medium text-blue-600 hover:underline">
              Back to password login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

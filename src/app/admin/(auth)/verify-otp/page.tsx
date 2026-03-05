"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { AlertCircle } from "lucide-react"

const SEND_OTP_COOLDOWN_SEC = 60
const SEND_OTP_URL = "/api/admin/auth/send-otp"
const VERIFY_OTP_URL = "/api/admin/auth/verify-otp"

function AdminVerifyOtpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") ?? ""
  const fromRegistration = searchParams.get("from") === "registration"
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(fromRegistration ? SEND_OTP_COOLDOWN_SEC : 0)

  const sendOtp = useCallback(async () => {
    if (!email.trim()) return
    const res = await fetch(SEND_OTP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setCooldown(SEND_OTP_COOLDOWN_SEC)
      setError("")
    } else {
      const msg = data.error || "Failed to send OTP."
      setError(msg)
      setTimeout(() => setError(""), 5000)
    }
  }, [email])

  useEffect(() => {
    if (!email.trim()) {
      setError("Email is required.")
      return
    }
    if (fromRegistration) return
    sendOtp()
  }, [email, fromRegistration, sendOtp])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (otp.length !== 6) {
      setError("Enter the 6-digit OTP.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(VERIFY_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.loginUrl) {
        router.push(data.loginUrl)
        return
      }
      setError(data.error || "Invalid or expired OTP.")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!email.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">
        <div className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-xl text-center">
          <p className="text-gray-600">Missing email. Please use the link from your registration or login.</p>
          <Link href="/admin/login" className="mt-4 inline-block text-blue-600 hover:underline">Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">
      <div className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <a href="/">
            <Image src="/images/logo.png" alt="Logo" width={180} height={48} className="h-12 w-auto object-contain" />
          </a>
        </div>
        <h1 className="text-center text-2xl font-semibold text-gray-900">Verify your email</h1>
        <p className="mt-1 text-center text-sm text-gray-500">We sent a 6-digit code to {email}</p>
        <form onSubmit={handleSubmit} className="mt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <div>
              <Label htmlFor="otp">Enter 6-digit OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={loading}
                className="mt-1.5 text-center text-xl tracking-[0.5em] rounded-xl"
              />
            </div>
            <Button type="submit" disabled={loading || otp.length !== 6} className="w-full rounded-full">
              {loading ? "Verifying..." : "Verify"}
            </Button>
            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cooldown > 0}
                onClick={sendOtp}
                className="rounded-full"
              >
                {cooldown > 0 ? `Send OTP again (${cooldown}s)` : "Send OTP again"}
              </Button>
            </div>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/admin/login" className="font-medium text-blue-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  )
}

export default function AdminVerifyOtpPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <AdminVerifyOtpForm />
    </Suspense>
  )
}

"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AlertCircle, Eye, EyeOff } from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"

function RestaurantSellerResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = (searchParams.get("email") ?? "").trim()
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email) return setError("Email is missing. Please start again.")
    if (otp.length !== 6) return setError("Enter the 6-digit OTP.")
    if (newPassword.length < 6) return setError("Password must be at least 6 characters.")
    if (newPassword !== confirmPassword) return setError("Passwords do not match.")

    setLoading(true)
    try {
      const res = await fetch("/api/restaurant-seller/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || "Failed to reset password.")
      router.push(data.loginUrl || "/restaurant-seller/login?reset=1")
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
      const res = await fetch("/api/restaurant-seller/auth/forgot-password/send-otp", {
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

  if (!email) return <div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4"><div className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-xl text-center"><p className="text-gray-600">Missing email. Please start from forgot password.</p><Link href="/restaurant-seller/forgot-password" className="mt-4 inline-block text-blue-600 hover:underline">Go to forgot password</Link></div></div>

  return (
    <div className="flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden bg-gray-50/90 px-4 py-5 sm:p-4">
      <div className="w-full max-w-[440px] min-w-0 rounded-2xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6 md:p-8">
        <div className="mb-5 flex justify-center sm:mb-6"><a href="/"><Image src="/images/logo.png" alt="Logo" width={180} height={48} className="h-12 w-auto object-contain sm:h-14 sm:max-h-[70px]" /></a></div>
        <div className="mb-6 sm:mb-8"><h1 className="text-left text-xl font-semibold text-gray-900 sm:text-2xl">Restaurant Seller reset password</h1><p className="mt-1 text-left text-sm text-gray-500">Enter OTP sent to {email} and set your new password.</p></div>
        <form onSubmit={handleSubmit}>
          {error && <Alert variant="destructive" className="mb-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-5">
            <div><Label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-gray-700">OTP</Label><Input id="otp" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} required disabled={loading} className="rounded-xl border-gray-200 text-center tracking-[0.4em]" /></div>
            <div><Label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-gray-700">New password</Label><div className="relative"><Input id="newPassword" type={showPassword ? "text" : "password"} placeholder="**********" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200 pr-10" /><button type="button" tabIndex={-1} onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <div><Label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-700">Confirm new password</Label><div className="relative"><Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="**********" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200 pr-10" /><button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <div className="text-center"><Button type="submit" disabled={loading} className="mx-auto w-full rounded-full sm:max-w-[220px]">{loading ? "Resetting..." : "Reset Password"}</Button></div>
            <div className="text-center"><Button type="button" variant="outline" disabled={loading} onClick={resendOtp} className="rounded-full">Resend OTP</Button></div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600"><Link href="/restaurant-seller/login" className="font-medium text-blue-600 hover:underline">Back to login</Link></p>
        </form>
      </div>
    </div>
  )
}

export default function RestaurantSellerResetPasswordPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}><RestaurantSellerResetPasswordForm /></Suspense>
}

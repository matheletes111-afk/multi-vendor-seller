"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AlertCircle } from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"

export default function AdminForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || "Failed to send OTP.")
      router.push(`/admin/reset-password?email=${encodeURIComponent(email.trim())}`)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden bg-gray-50/90 px-4 py-5 sm:p-4">
      <div className="w-full max-w-[440px] min-w-0 rounded-2xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6 md:p-8">
        <div className="mb-5 flex justify-center sm:mb-6"><a href="/"><Image src="/images/logo.png" alt="Logo" width={180} height={48} className="h-12 w-auto object-contain sm:h-14 sm:max-h-[70px]" /></a></div>
        <div className="mb-6 sm:mb-8"><h1 className="text-left text-xl font-semibold text-gray-900 sm:text-2xl">Admin forgot password</h1><p className="mt-1 text-left text-sm text-gray-500">Enter your email to receive OTP.</p></div>
        <form onSubmit={handleSubmit}>
          {error && <Alert variant="destructive" className="mb-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-5">
            <div><Label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">Email</Label><Input id="email" type="email" placeholder="example@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200" /></div>
            <div className="text-center"><Button type="submit" disabled={loading} className="mx-auto w-full rounded-full sm:max-w-[220px]">{loading ? "Sending OTP..." : "Send OTP"}</Button></div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600"><Link href="/admin/login" className="font-medium text-blue-600 hover:underline">Back to login</Link></p>
        </form>
      </div>
    </div>
  )
}

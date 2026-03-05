"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { AlertCircle, Eye, EyeOff } from "lucide-react"

export default function ProductSellerRegistrationPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirmPassword) { setError("Passwords do not match"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/product-seller/auth/registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Registration failed"); return }
      router.push("/product-seller/login?registered=true")
    } catch { setError("An error occurred. Please try again.") } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">
      <div className="w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
        <a href="/">
          <Image src="/images/logo.png" alt="Logo" width={180} height={48} className="h-12 w-auto object-contain" />
        </a>
      </div>
        <div className="mb-8"><h1 className="text-center text-2xl font-semibold text-gray-900">Product Seller Registration</h1><p className="mt-1 text-center text-sm text-gray-500">Register to sell products</p></div>
        <form onSubmit={handleSubmit}>
          {error && <Alert variant="destructive" className="mb-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-5">
            <div><Label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-700">Full Name</Label><Input id="name" type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200" /></div>
            <div><Label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">Email</Label><Input id="email" type="email" placeholder="example@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200" /></div>
            <div><Label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">Password</Label><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} placeholder="**********" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200 pr-10" /><button type="button" tabIndex={-1} onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <div><Label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-700">Confirm Password</Label><div className="relative"><Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="**********" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} className="rounded-xl border-gray-200 pr-10" /><button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <div className="text-center"><Button type="submit" disabled={loading} className="mx-auto w-full max-w-[200px] rounded-full">{loading ? "Creating account..." : "Create Account"}</Button></div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600">Already have an account? <Link href="/product-seller/login" className="font-medium text-blue-600 hover:underline">Product Seller Sign In</Link></p>
        </form>
      </div>
    </div>
  )
}

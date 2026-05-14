"use client"

import { useState } from "react"
import { signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Checkbox } from "@/ui/checkbox-v2"
import { Alert, AlertDescription } from "@/ui/alert"
import { AlertCircle, Eye, EyeOff } from "lucide-react"

export default function RestaurantSellerRegistrationPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())

    try {
      const res = await fetch("/api/restaurant-seller/auth/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()
      if (res.ok) {
        router.push(result.verifyUrl + `?email=${encodeURIComponent(data.email as string)}&from=registration`)
      } else {
        setError(result.error || "Registration failed. Please try again.")
      }
    } catch {
      setError("Something went wrong. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">
      <div className="w-full max-w-[500px] rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <a href="/">
            <Image src="/images/logo.png" alt="Logo" width={180} height={48} className="h-12 w-auto object-contain" />
          </a>
        </div>
        <h1 className="text-center text-2xl font-semibold text-gray-900">Restaurant Seller Registration</h1>
        <p className="mt-1 text-center text-sm text-gray-500">Create your restaurant seller account</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" placeholder="John Doe" required className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input id="email" name="email" type="email" placeholder="john@restaurant.com" required className="rounded-xl" />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr]">
            <div className="space-y-2">
              <Label htmlFor="phoneCountryCode">Country Code</Label>
              <Input id="phoneCountryCode" name="phoneCountryCode" type="tel" placeholder="+1" defaultValue="+91" required className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" type="tel" placeholder="9876543210" required className="rounded-xl" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                className="rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-start space-x-2 pt-2">
            <Checkbox id="terms" required className="mt-1" />
            <label htmlFor="terms" className="text-xs text-gray-500 leading-tight">
              I agree to the <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </label>
          </div>

          <Button type="submit" disabled={loading} className="w-full rounded-full py-6 mt-4 text-base font-semibold shadow-lg shadow-blue-100">
            {loading ? "Creating Account..." : "Create Account"}
          </Button>

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
                  const callbackUrlWithRole = `/api/auth/oauth-postprocess?role=SELLER_RESTAURANT&next=/restaurant-seller/onboarding`
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
                  const callbackUrlWithRole = `/api/auth/oauth-postprocess?role=SELLER_RESTAURANT&next=/restaurant-seller/onboarding`
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
          Already have an account?{" "}
          <Link href="/restaurant-seller/login" className="font-medium text-blue-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}

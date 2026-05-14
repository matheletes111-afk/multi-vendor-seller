"use client"

import { Suspense } from "react"
import { EmailOtpLoginVerifyForm } from "@/components/auth/email-otp-login"

function RestaurantSellerEmailOtpVerifyPageInner() {
  return (
    <EmailOtpLoginVerifyForm
      config={{
        panelTitle: "Restaurant Seller",
        sendOtpApi: "/api/restaurant-seller/auth/email-otp/send-otp",
        verifyOtpApi: "/api/restaurant-seller/auth/email-otp/verify-otp",
        loginApi: "/api/restaurant-seller/auth/login",
        loginPath: "/restaurant-seller/login",
        requestPath: "/restaurant-seller/login/email-otp",
        verifyPath: "/restaurant-seller/login/email-otp/verify",
        defaultCallbackUrl: "/restaurant-seller",
      }}
    />
  )
}

export default function RestaurantSellerEmailOtpVerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <RestaurantSellerEmailOtpVerifyPageInner />
    </Suspense>
  )
}

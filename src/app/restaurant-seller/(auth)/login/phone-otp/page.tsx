"use client"

import { Suspense } from "react"
import { PhoneOtpLoginRequestForm } from "@/components/auth/phone-otp-login"

function RestaurantSellerPhoneOtpLoginPageInner() {
  return (
    <PhoneOtpLoginRequestForm
      config={{
        panelTitle: "Restaurant Seller",
        sendOtpApi: "/api/restaurant-seller/auth/phone-otp/send-otp",
        verifyOtpApi: "/api/restaurant-seller/auth/phone-otp/verify-otp",
        loginApi: "/api/restaurant-seller/auth/login",
        loginPath: "/restaurant-seller/login",
        requestPath: "/restaurant-seller/login/phone-otp",
        verifyPath: "/restaurant-seller/login/phone-otp/verify",
        defaultCallbackUrl: "/restaurant-seller",
      }}
    />
  )
}

export default function RestaurantSellerPhoneOtpLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <RestaurantSellerPhoneOtpLoginPageInner />
    </Suspense>
  )
}

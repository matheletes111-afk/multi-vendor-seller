"use client"

import { Suspense } from "react"
import { PhoneOtpLoginRequestForm } from "@/components/auth/phone-otp-login"

function HotelSellerPhoneOtpLoginPageInner() {
  return (
    <PhoneOtpLoginRequestForm
      config={{
        panelTitle: "Hotel Seller",
        sendOtpApi: "/api/hotel-seller/auth/phone-otp/send-otp",
        verifyOtpApi: "/api/hotel-seller/auth/phone-otp/verify-otp",
        loginApi: "/api/hotel-seller/auth/login",
        loginPath: "/hotel-seller/login",
        requestPath: "/hotel-seller/login/phone-otp",
        verifyPath: "/hotel-seller/login/phone-otp/verify",
        defaultCallbackUrl: "/hotel-seller",
      }}
    />
  )
}

export default function HotelSellerPhoneOtpLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <HotelSellerPhoneOtpLoginPageInner />
    </Suspense>
  )
}

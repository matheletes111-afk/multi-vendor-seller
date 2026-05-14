"use client"

import { Suspense } from "react"
import { EmailOtpLoginRequestForm } from "@/components/auth/email-otp-login"

function HotelSellerEmailOtpLoginPageInner() {
  return (
    <EmailOtpLoginRequestForm
      config={{
        panelTitle: "Hotel Seller",
        sendOtpApi: "/api/hotel-seller/auth/email-otp/send-otp",
        verifyOtpApi: "/api/hotel-seller/auth/email-otp/verify-otp",
        loginApi: "/api/hotel-seller/auth/login",
        loginPath: "/hotel-seller/login",
        requestPath: "/hotel-seller/login/email-otp",
        verifyPath: "/hotel-seller/login/email-otp/verify",
        defaultCallbackUrl: "/hotel-seller",
      }}
    />
  )
}

export default function HotelSellerEmailOtpLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <HotelSellerEmailOtpLoginPageInner />
    </Suspense>
  )
}

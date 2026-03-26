"use client"

import { Suspense } from "react"
import { PhoneOtpLoginRequestForm } from "@/components/auth/phone-otp-login"

function ServiceSellerPhoneOtpLoginPageInner() {
  return (
    <PhoneOtpLoginRequestForm
      config={{
        panelTitle: "Service Seller",
        sendOtpApi: "/api/service-seller/auth/phone-otp/send-otp",
        verifyOtpApi: "/api/service-seller/auth/phone-otp/verify-otp",
        loginApi: "/api/service-seller/auth/login",
        loginPath: "/service-seller/login",
        requestPath: "/service-seller/login/phone-otp",
        verifyPath: "/service-seller/login/phone-otp/verify",
        defaultCallbackUrl: "/service-seller",
      }}
    />
  )
}

export default function ServiceSellerPhoneOtpLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <ServiceSellerPhoneOtpLoginPageInner />
    </Suspense>
  )
}

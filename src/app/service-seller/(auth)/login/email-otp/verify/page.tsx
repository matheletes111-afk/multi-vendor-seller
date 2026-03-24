"use client"

import { Suspense } from "react"
import { EmailOtpLoginVerifyForm } from "@/components/auth/email-otp-login"

function ServiceSellerEmailOtpVerifyPageInner() {
  return (
    <EmailOtpLoginVerifyForm
      config={{
        panelTitle: "Service Seller",
        sendOtpApi: "/api/service-seller/auth/email-otp/send-otp",
        verifyOtpApi: "/api/service-seller/auth/email-otp/verify-otp",
        loginApi: "/api/service-seller/auth/login",
        loginPath: "/service-seller/login",
        requestPath: "/service-seller/login/email-otp",
        verifyPath: "/service-seller/login/email-otp/verify",
        defaultCallbackUrl: "/service-seller",
      }}
    />
  )
}

export default function ServiceSellerEmailOtpVerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <ServiceSellerEmailOtpVerifyPageInner />
    </Suspense>
  )
}

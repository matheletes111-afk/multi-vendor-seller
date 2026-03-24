"use client"

import { Suspense } from "react"
import { EmailOtpLoginRequestForm } from "@/components/auth/email-otp-login"

function ServiceSellerEmailOtpLoginPageInner() {
  return (
    <EmailOtpLoginRequestForm
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

export default function ServiceSellerEmailOtpLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <ServiceSellerEmailOtpLoginPageInner />
    </Suspense>
  )
}

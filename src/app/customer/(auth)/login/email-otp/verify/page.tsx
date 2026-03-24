"use client"

import { Suspense } from "react"
import { EmailOtpLoginVerifyForm } from "@/components/auth/email-otp-login"

function CustomerEmailOtpVerifyPageInner() {
  return (
    <EmailOtpLoginVerifyForm
      config={{
        panelTitle: "Customer",
        sendOtpApi: "/api/customer/auth/email-otp/send-otp",
        verifyOtpApi: "/api/customer/auth/email-otp/verify-otp",
        loginApi: "/api/customer/auth/login",
        loginPath: "/customer/login",
        requestPath: "/customer/login/email-otp",
        verifyPath: "/customer/login/email-otp/verify",
        defaultCallbackUrl: "/",
      }}
    />
  )
}

export default function CustomerEmailOtpVerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <CustomerEmailOtpVerifyPageInner />
    </Suspense>
  )
}

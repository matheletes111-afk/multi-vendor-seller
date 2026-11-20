"use client"

import { Suspense } from "react"
import { EmailOtpLoginVerifyForm } from "@/components/auth/email-otp-login"

function RiderEmailOtpVerifyPageInner() {
  return (
    <EmailOtpLoginVerifyForm
      config={{
        panelTitle: "Delivery Rider",
        sendOtpApi: "/api/riderapp/auth/email-otp/send-otp",
        verifyOtpApi: "/api/riderapp/auth/email-otp/verify-otp",
        loginApi: "/api/riderapp/auth/login",
        loginPath: "/riderapp/login",
        requestPath: "/riderapp/login/email-otp",
        verifyPath: "/riderapp/login/email-otp/verify",
        defaultCallbackUrl: "/riderapp",
      }}
    />
  )
}

export default function RiderEmailOtpVerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <RiderEmailOtpVerifyPageInner />
    </Suspense>
  )
}

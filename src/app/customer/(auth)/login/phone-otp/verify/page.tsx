"use client"

import { Suspense } from "react"
import { PhoneOtpLoginVerifyForm } from "@/components/auth/phone-otp-login"

function CustomerPhoneOtpVerifyPageInner() {
  return (
    <PhoneOtpLoginVerifyForm
      config={{
        panelTitle: "Customer",
        sendOtpApi: "/api/customer/auth/phone-otp/send-otp",
        verifyOtpApi: "/api/customer/auth/phone-otp/verify-otp",
        loginApi: "/api/customer/auth/login",
        loginPath: "/customer/login",
        requestPath: "/customer/login/phone-otp",
        verifyPath: "/customer/login/phone-otp/verify",
        defaultCallbackUrl: "/",
      }}
    />
  )
}

export default function CustomerPhoneOtpVerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <CustomerPhoneOtpVerifyPageInner />
    </Suspense>
  )
}

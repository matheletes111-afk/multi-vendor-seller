"use client"

import { Suspense } from "react"
import { PhoneOtpLoginRequestForm } from "@/components/auth/phone-otp-login"

function RiderPhoneOtpLoginPageInner() {
  return (
    <PhoneOtpLoginRequestForm
      config={{
        panelTitle: "Delivery Rider",
        sendOtpApi: "/api/riderapp/auth/phone-otp/send-otp",
        verifyOtpApi: "/api/riderapp/auth/phone-otp/verify-otp",
        loginApi: "/api/riderapp/auth/login",
        loginPath: "/riderapp/login",
        requestPath: "/riderapp/login/phone-otp",
        verifyPath: "/riderapp/login/phone-otp/verify",
        defaultCallbackUrl: "/riderapp",
        registrationPath: "/riderapp/registration",
      }}
    />
  )
}

export default function RiderPhoneOtpLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <RiderPhoneOtpLoginPageInner />
    </Suspense>
  )
}

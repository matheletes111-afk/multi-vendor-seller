"use client"

import { Suspense } from "react"
import { PhoneOtpLoginVerifyForm } from "@/components/auth/phone-otp-login"

function ProductSellerPhoneOtpVerifyPageInner() {
  return (
    <PhoneOtpLoginVerifyForm
      config={{
        panelTitle: "Product Seller",
        sendOtpApi: "/api/product-seller/auth/phone-otp/send-otp",
        verifyOtpApi: "/api/product-seller/auth/phone-otp/verify-otp",
        loginApi: "/api/product-seller/auth/login",
        loginPath: "/product-seller/login",
        requestPath: "/product-seller/login/phone-otp",
        verifyPath: "/product-seller/login/phone-otp/verify",
        defaultCallbackUrl: "/product-seller",
      }}
    />
  )
}

export default function ProductSellerPhoneOtpVerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <ProductSellerPhoneOtpVerifyPageInner />
    </Suspense>
  )
}

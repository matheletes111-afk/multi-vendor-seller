"use client"

import { Suspense } from "react"
import { EmailOtpLoginVerifyForm } from "@/components/auth/email-otp-login"

function ProductSellerEmailOtpVerifyPageInner() {
  return (
    <EmailOtpLoginVerifyForm
      config={{
        panelTitle: "Product Seller",
        sendOtpApi: "/api/product-seller/auth/email-otp/send-otp",
        verifyOtpApi: "/api/product-seller/auth/email-otp/verify-otp",
        loginApi: "/api/product-seller/auth/login",
        loginPath: "/product-seller/login",
        requestPath: "/product-seller/login/email-otp",
        verifyPath: "/product-seller/login/email-otp/verify",
        defaultCallbackUrl: "/product-seller",
      }}
    />
  )
}

export default function ProductSellerEmailOtpVerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50/90 p-4">Loading...</div>}>
      <ProductSellerEmailOtpVerifyPageInner />
    </Suspense>
  )
}

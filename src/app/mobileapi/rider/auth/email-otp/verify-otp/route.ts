import { handleRiderEmailOtpVerify } from "@/lib/rider-auth"

/** POST /mobileapi/rider/auth/email-otp/verify-otp — Body: { email, otp, deviceId?, platform?, deviceToken?, userAgent? } */
export async function POST(request: Request) {
  return handleRiderEmailOtpVerify(request, { isMobile: true })
}

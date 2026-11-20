import { handleRiderEmailOtpVerify } from "@/lib/rider-auth"

/** POST /api/riderapp/auth/email-otp/verify-otp — Body: { email, otp } */
export async function POST(request: Request) {
  return handleRiderEmailOtpVerify(request, { isMobile: false })
}

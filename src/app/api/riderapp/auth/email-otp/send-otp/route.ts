import { handleRiderEmailOtpSend } from "@/lib/rider-auth"

/** POST /api/riderapp/auth/email-otp/send-otp — Body: { email } */
export async function POST(request: Request) {
  return handleRiderEmailOtpSend(request, { isMobile: false })
}

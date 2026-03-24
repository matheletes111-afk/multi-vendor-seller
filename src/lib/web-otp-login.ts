import jwt from "jsonwebtoken"
import { UserRole } from "@prisma/client"

type OtpLoginPayload = {
  type: "web-login-otp"
  email: string
  role: UserRole
}

const OTP_LOGIN_SECRET =
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.JWT_SECRET_KEY?.trim() ||
  process.env.MOBILE_JWT_SECRET_KEY?.trim() ||
  ""

const OTP_LOGIN_EXPIRES_IN = "10m"

export function createOtpLoginToken(email: string, role: UserRole): string {
  if (!OTP_LOGIN_SECRET) throw new Error("Missing NEXTAUTH_SECRET/JWT secret for OTP login token")
  const payload: OtpLoginPayload = {
    type: "web-login-otp",
    email: email.toLowerCase().trim(),
    role,
  }
  return jwt.sign(payload, OTP_LOGIN_SECRET, { expiresIn: OTP_LOGIN_EXPIRES_IN })
}

export function verifyOtpLoginToken(token: string): OtpLoginPayload | null {
  try {
    if (!OTP_LOGIN_SECRET || !token) return null
    const decoded = jwt.verify(token, OTP_LOGIN_SECRET) as jwt.JwtPayload & Partial<OtpLoginPayload>
    if (
      decoded?.type !== "web-login-otp" ||
      typeof decoded.email !== "string" ||
      typeof decoded.role !== "string"
    ) {
      return null
    }
    return {
      type: "web-login-otp",
      email: decoded.email.toLowerCase().trim(),
      role: decoded.role as UserRole,
    }
  } catch {
    return null
  }
}

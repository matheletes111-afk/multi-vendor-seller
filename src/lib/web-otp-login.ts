import jwt from "jsonwebtoken"
import { UserRole } from "@prisma/client"

export type OtpLoginPayload = {
  type: "web-login-otp"
  email?: string | null
  phone?: string | null
  userId?: string
  role: UserRole
}

const OTP_LOGIN_SECRET =
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.JWT_SECRET_KEY?.trim() ||
  process.env.MOBILE_JWT_SECRET_KEY?.trim() ||
  ""

const OTP_LOGIN_EXPIRES_IN = "10m"

export function createOtpLoginToken(
  identifier: string | null | undefined,
  role: UserRole,
  extra?: { userId?: string; phone?: string | null; email?: string | null }
): string {
  if (!OTP_LOGIN_SECRET) throw new Error("Missing NEXTAUTH_SECRET/JWT secret for OTP login token")
  const resolvedEmail = extra?.email ?? (identifier && identifier.includes("@") ? identifier : null)
  const resolvedPhone = extra?.phone ?? (identifier && !identifier.includes("@") ? identifier : null)
  const payload: OtpLoginPayload = {
    type: "web-login-otp",
    email: resolvedEmail ? resolvedEmail.toLowerCase().trim() : null,
    phone: resolvedPhone ? resolvedPhone.trim() : null,
    userId: extra?.userId,
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
      typeof decoded.role !== "string"
    ) {
      return null
    }
    return {
      type: "web-login-otp",
      email: typeof decoded.email === "string" ? decoded.email.toLowerCase().trim() : null,
      phone: typeof decoded.phone === "string" ? decoded.phone.trim() : null,
      userId: typeof decoded.userId === "string" ? decoded.userId : undefined,
      role: decoded.role as UserRole,
    }
  } catch {
    return null
  }
}

import { prisma } from "@/lib/prisma"

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export async function checkOtpRateLimit(identifier: string): Promise<{ allowed: boolean; remainingAttempts: number; blockTimeLeftMs: number }> {
  const now = new Date()
  const record = await prisma.otpAttempt.findUnique({
    where: { identifier },
  })

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, blockTimeLeftMs: 0 }
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, remainingAttempts: 0, blockTimeLeftMs: record.blockedUntil.getTime() - now.getTime() }
  }

  // Reset block if lockout expired
  if (record.blockedUntil && record.blockedUntil <= now) {
    await prisma.otpAttempt.deleteMany({
      where: { identifier },
    })
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, blockTimeLeftMs: 0 }
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.attempts, blockTimeLeftMs: 0 }
}

export async function recordOtpFailure(identifier: string): Promise<{ remainingAttempts: number; blockedUntil: Date | null }> {
  const now = new Date()
  const blockTime = new Date(now.getTime() + LOCKOUT_DURATION_MS)

  const record = await prisma.otpAttempt.upsert({
    where: { identifier },
    create: {
      identifier,
      attempts: 1,
    },
    update: {
      attempts: { increment: 1 },
    },
  })

  let blockedUntil: Date | null = null
  if (record.attempts >= MAX_ATTEMPTS) {
    blockedUntil = blockTime
    await prisma.otpAttempt.update({
      where: { identifier },
      data: { blockedUntil },
    })
  }

  return {
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.attempts),
    blockedUntil,
  }
}

export async function resetOtpRateLimit(identifier: string): Promise<void> {
  await prisma.otpAttempt.deleteMany({
    where: { identifier },
  })
}

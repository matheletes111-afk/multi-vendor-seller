import crypto from "crypto"

/**
 * Generates a cryptographically strong random password.
 * Guaranteed to contain:
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export function generateSecurePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ" // Omitted confusing chars like I, O
  const lower = "abcdefghjkmnpqrstuvwxyz"  // Omitted confusing chars like l, o
  const digits = "23456789"                // Omitted 0, 1
  const special = "!@#$%^&*()-_=+"
  const allChars = upper + lower + digits + special

  // Ensure at least one character from each set
  let password = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    special[crypto.randomInt(0, special.length)],
  ]

  // Fill the remaining length
  for (let i = password.length; i < length; i++) {
    password.push(allChars[crypto.randomInt(0, allChars.length)])
  }

  // Shuffle the password array using Fisher-Yates
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    const temp = password[i]
    password[i] = password[j]
    password[j] = temp
  }

  return password.join("")
}

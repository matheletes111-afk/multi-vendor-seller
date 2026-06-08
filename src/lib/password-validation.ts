/**
 * Validates password strength.
 *
 * Rules:
 * - Must be at least 8 characters long.
 * - Must contain at least one uppercase letter (A-Z).
 * - Must contain at least one lowercase letter (a-z).
 * - Must contain at least one digit (0-9).
 * - Must contain at least one special character (e.g. !@#$%^&* etc.).
 */
export function validatePassword(password: any): {
  isValid: boolean
  error?: string
} {
  if (typeof password !== "string") {
    return { isValid: false, error: "Password must be a string" }
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters long.",
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one uppercase letter.",
    }
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one lowercase letter.",
    }
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one number.",
    }
  }

  // Check for at least one character that is NOT a letter or digit
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one special character.",
    }
  }

  return { isValid: true }
}

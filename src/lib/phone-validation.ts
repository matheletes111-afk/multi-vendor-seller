/**
 * Validates country code and phone number formats.
 *
 * Rules:
 * - Country code: Starts with optional '+' and has 1 to 4 digits.
 * - Phone: Between 7 and 15 digits after removing formatting characters (spaces, hyphens, parentheses).
 */
export function validatePhoneAndCountryCode(
  phone: any,
  phoneCountryCode: any
): {
  isValid: boolean
  error?: string
  cleanedPhone?: string
  cleanedCountryCode?: string
} {
  if (typeof phone !== "string") {
    return { isValid: false, error: "Phone number must be a string" }
  }
  if (typeof phoneCountryCode !== "string") {
    return { isValid: false, error: "Phone country code must be a string" }
  }

  const cleanedCountryCode = phoneCountryCode.trim()
  const cleanedPhone = phone.replace(/[\s\-()]/g, "")

  // Validate country code: starts with optional + and is 1-4 digits
  const countryCodeRegex = /^\+?[1-9]\d{0,3}$/
  if (!countryCodeRegex.test(cleanedCountryCode)) {
    return {
      isValid: false,
      error: "Invalid phone country code. Must start with '+' followed by 1 to 4 digits.",
    }
  }

  // Validate phone number: only digits and 7 to 15 in length
  const phoneRegex = /^\d{7,15}$/
  if (!phoneRegex.test(cleanedPhone)) {
    return {
      isValid: false,
      error: "Invalid phone number. Must contain between 7 and 15 digits.",
    }
  }

  return {
    isValid: true,
    cleanedPhone,
    cleanedCountryCode,
  }
}

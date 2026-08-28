/**
 * Validates country code and phone number formats.
 *
 * Rules:
 * - Country code: Starts with optional '+' and has 1 to 4 digits (e.g. +232, +1, +91).
 * - Phone: Supports numbers with leading zero (e.g. 088994462), without leading zero (e.g. 88994462),
 *   formatted numbers (088 994 462, 088-994-462), and embedded country codes (+23288994462).
 * - Digits: Between 6 and 15 digits.
 */
export function validatePhoneAndCountryCode(
  phone: any,
  phoneCountryCode: any
): {
  isValid: boolean
  error?: string
  cleanedPhone?: string
  cleanedCountryCode?: string
  fullE164?: string
} {
  if (phone === undefined || phone === null || typeof phone !== "string" || !phone.trim()) {
    return { isValid: false, error: "Phone number is required" }
  }
  if (
    phoneCountryCode === undefined ||
    phoneCountryCode === null ||
    typeof phoneCountryCode !== "string" ||
    !phoneCountryCode.trim()
  ) {
    return { isValid: false, error: "Phone country code is required" }
  }

  // Sanitize country code
  const rawCountryCode = phoneCountryCode.trim()
  const ccDigits = rawCountryCode.replace(/\D/g, "")
  if (!ccDigits || ccDigits.length > 4 || ccDigits.startsWith("0")) {
    return {
      isValid: false,
      error: "Invalid phone country code. Must be 1 to 4 digits (e.g. +232, +1, +91).",
    }
  }
  const cleanedCountryCode = `+${ccDigits}`

  // Sanitize phone number (strip spaces, hyphens, brackets, dots, commas, slashes)
  let rawPhone = phone.trim().replace(/[\s\-().,/_]/g, "")

  // If user included leading '+' in the phone field
  if (rawPhone.startsWith("+")) {
    const afterPlus = rawPhone.slice(1)
    if (afterPlus.startsWith(ccDigits)) {
      rawPhone = afterPlus.slice(ccDigits.length)
    } else {
      rawPhone = afterPlus
    }
  } else {
    // If user included country code digits without '+' in the phone field
    // (e.g. 232088994462 or 23288994462 where ccDigits is 232 and length >= 9)
    if (rawPhone.startsWith(ccDigits) && rawPhone.length >= ccDigits.length + 6) {
      rawPhone = rawPhone.slice(ccDigits.length)
    }
  }

  // Remove any remaining non-digit characters
  const digitsOnly = rawPhone.replace(/\D/g, "")

  // Validate phone length: between 6 and 15 digits (covers 8-digit & 9-digit Sierra Leone, plus international)
  if (!digitsOnly || digitsOnly.length < 6 || digitsOnly.length > 15) {
    return {
      isValid: false,
      error: "Invalid phone number. Must contain between 6 and 15 digits.",
    }
  }

  const cleanedPhone = digitsOnly
  const noLeadingZero = digitsOnly.replace(/^0+/, "")
  const fullE164 = `${cleanedCountryCode}${noLeadingZero}`

  return {
    isValid: true,
    cleanedPhone,
    cleanedCountryCode,
    fullE164,
  }
}

/**
 * Returns all equivalent representations of a phone number for database duplicate checks & lookups.
 * (e.g. "088994462", "88994462", "+23288994462", "23288994462", "+232088994462", "232088994462")
 */
export function getEquivalentPhoneVariants(
  phone?: string | null,
  countryCode?: string | null
): string[] {
  if (!phone) return []
  const digits = String(phone).replace(/\D/g, "")
  if (!digits) return []

  const variants = new Set<string>()
  variants.add(digits)

  const noLeadingZero = digits.replace(/^0+/, "")
  if (noLeadingZero) {
    variants.add(noLeadingZero)
    variants.add(`0${noLeadingZero}`)
  }

  if (countryCode) {
    const ccDigits = String(countryCode).replace(/\D/g, "")
    if (ccDigits) {
      if (noLeadingZero) {
        variants.add(`+${ccDigits}${noLeadingZero}`)
        variants.add(`${ccDigits}${noLeadingZero}`)
        variants.add(`+${ccDigits}0${noLeadingZero}`)
        variants.add(`${ccDigits}0${noLeadingZero}`)
      }
      variants.add(`+${ccDigits}${digits}`)
      variants.add(`${ccDigits}${digits}`)
    }
  }

  return Array.from(variants)
}

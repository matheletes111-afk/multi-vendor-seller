/**
 * Build candidate (phoneCountryCode, phone) pairs and phone strings from E.164
 * for DB lookup when fields are split or stored in alternate formats (with or without leading zero).
 */
export function getCandidateCountryCodePhonePairs(e164Phone: string): Array<{ countryCode: string; phone: string }> {
  const digits = e164Phone.replace(/^\+/, "").replace(/\D/g, "")
  if (!digits) return []

  const pairs: Array<{ countryCode: string; phone: string }> = []
  const seen = new Set<string>()

  const addPair = (countryCode: string, phone: string) => {
    const key = `${countryCode}:${phone}`
    if (!seen.has(key)) {
      seen.add(key)
      pairs.push({ countryCode, phone })
    }
  }

  for (let ccLen = 1; ccLen <= 4; ccLen++) {
    if (digits.length <= ccLen + 4) continue
    const countryCodeDigits = digits.slice(0, ccLen)
    const localPhone = digits.slice(ccLen)
    const localNoZero = localPhone.replace(/^0+/, "")
    const localWithZero = `0${localNoZero}`

    // Matches with +countryCode
    addPair(`+${countryCodeDigits}`, localPhone)
    if (localNoZero) addPair(`+${countryCodeDigits}`, localNoZero)
    if (localWithZero) addPair(`+${countryCodeDigits}`, localWithZero)

    // Matches with countryCode without +
    addPair(countryCodeDigits, localPhone)
    if (localNoZero) addPair(countryCodeDigits, localNoZero)
    if (localWithZero) addPair(countryCodeDigits, localWithZero)
  }

  return pairs
}

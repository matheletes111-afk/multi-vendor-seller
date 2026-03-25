/** Build (phoneCountryCode, phone) pairs from E.164 for DB lookup when fields are split. */
export function getCandidateCountryCodePhonePairs(e164Phone: string): Array<{ countryCode: string; phone: string }> {
  const digits = e164Phone.replace(/^\+/, "")
  const pairs: Array<{ countryCode: string; phone: string }> = []
  for (let ccLen = 1; ccLen <= 3; ccLen++) {
    if (digits.length <= ccLen) continue
    const countryCodeDigits = digits.slice(0, ccLen)
    const localPhone = digits.slice(ccLen)
    pairs.push({ countryCode: `+${countryCodeDigits}`, phone: localPhone })
    pairs.push({ countryCode: countryCodeDigits, phone: localPhone })
  }
  return pairs
}

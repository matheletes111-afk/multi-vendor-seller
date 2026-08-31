export interface Country {
  name: string
  code: string // ISO 3166-1 alpha-2 (e.g. "SL", "IN", "US")
  dialCode: string // e.g. "+232", "+91", "+1"
  flagEmoji: string // e.g. "🇸🇱", "🇮🇳", "🇺🇸"
  priority?: number
}

/**
 * Returns FlagCDN image URL for given 2-letter ISO country code.
 * Example: "SL" -> "https://flagcdn.com/w40/sl.png"
 */
export function getFlagImageUrl(countryCode: string): string {
  if (!countryCode) return ""
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`
}

/**
 * Generates Unicode flag emoji from 2-letter ISO code.
 */
export function getCountryFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌐"
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

/**
 * Complete list of countries with calling codes and ISO alpha-2 codes.
 * Popular/frequent countries in this platform are placed at the top for quick access.
 */
export const COUNTRIES: Country[] = [
  // Priority countries for this platform (Sierra Leone & regional + major countries)
  { name: "Sierra Leone", code: "SL", dialCode: "+232", flagEmoji: "🇸🇱", priority: 1 },
  { name: "India", code: "IN", dialCode: "+91", flagEmoji: "🇮🇳", priority: 2 },
  { name: "United States", code: "US", dialCode: "+1", flagEmoji: "🇺🇸", priority: 3 },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flagEmoji: "🇬🇧", priority: 4 },
  { name: "Nigeria", code: "NG", dialCode: "+234", flagEmoji: "🇳🇬", priority: 5 },
  { name: "Ghana", code: "GH", dialCode: "+233", flagEmoji: "🇬🇭", priority: 6 },
  { name: "Liberia", code: "LR", dialCode: "+231", flagEmoji: "🇱🇷", priority: 7 },
  { name: "Guinea", code: "GN", dialCode: "+224", flagEmoji: "🇬🇳", priority: 8 },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flagEmoji: "🇦🇪", priority: 9 },
  { name: "Canada", code: "CA", dialCode: "+1", flagEmoji: "🇨🇦", priority: 10 },

  // Worldwide alphabetical list
  { name: "Afghanistan", code: "AF", dialCode: "+93", flagEmoji: "🇦🇫" },
  { name: "Albania", code: "AL", dialCode: "+355", flagEmoji: "🇦🇱" },
  { name: "Algeria", code: "DZ", dialCode: "+213", flagEmoji: "🇩🇿" },
  { name: "Andorra", code: "AD", dialCode: "+376", flagEmoji: "🇦🇩" },
  { name: "Angola", code: "AO", dialCode: "+244", flagEmoji: "🇦🇴" },
  { name: "Argentina", code: "AR", dialCode: "+54", flagEmoji: "🇦🇷" },
  { name: "Armenia", code: "AM", dialCode: "+374", flagEmoji: "🇦🇲" },
  { name: "Australia", code: "AU", dialCode: "+61", flagEmoji: "🇦🇺" },
  { name: "Austria", code: "AT", dialCode: "+43", flagEmoji: "🇦🇹" },
  { name: "Azerbaijan", code: "AZ", dialCode: "+994", flagEmoji: "🇦🇿" },
  { name: "Bahamas", code: "BS", dialCode: "+1242", flagEmoji: "🇧🇸" },
  { name: "Bahrain", code: "BH", dialCode: "+973", flagEmoji: "🇧🇭" },
  { name: "Bangladesh", code: "BD", dialCode: "+880", flagEmoji: "🇧🇩" },
  { name: "Barbados", code: "BB", dialCode: "+1246", flagEmoji: "🇧🇧" },
  { name: "Belarus", code: "BY", dialCode: "+375", flagEmoji: "🇧🇾" },
  { name: "Belgium", code: "BE", dialCode: "+32", flagEmoji: "🇧🇪" },
  { name: "Belize", code: "BZ", dialCode: "+501", flagEmoji: "🇧🇿" },
  { name: "Benin", code: "BJ", dialCode: "+229", flagEmoji: "🇧🇯" },
  { name: "Bhutan", code: "BT", dialCode: "+975", flagEmoji: "🇧🇹" },
  { name: "Bolivia", code: "BO", dialCode: "+591", flagEmoji: "🇧🇴" },
  { name: "Bosnia and Herzegovina", code: "BA", dialCode: "+387", flagEmoji: "🇧🇦" },
  { name: "Botswana", code: "BW", dialCode: "+267", flagEmoji: "🇧🇼" },
  { name: "Brazil", code: "BR", dialCode: "+55", flagEmoji: "🇧🇷" },
  { name: "Brunei", code: "BN", dialCode: "+673", flagEmoji: "🇧🇳" },
  { name: "Bulgaria", code: "BG", dialCode: "+359", flagEmoji: "🇧🇬" },
  { name: "Burkina Faso", code: "BF", dialCode: "+226", flagEmoji: "🇧🇫" },
  { name: "Burundi", code: "BI", dialCode: "+257", flagEmoji: "🇧🇮" },
  { name: "Cambodia", code: "KH", dialCode: "+855", flagEmoji: "🇰🇭" },
  { name: "Cameroon", code: "CM", dialCode: "+237", flagEmoji: "🇨🇲" },
  { name: "Cape Verde", code: "CV", dialCode: "+238", flagEmoji: "🇨🇻" },
  { name: "Central African Republic", code: "CF", dialCode: "+236", flagEmoji: "🇨🇫" },
  { name: "Chad", code: "TD", dialCode: "+235", flagEmoji: "🇹🇩" },
  { name: "Chile", code: "CL", dialCode: "+56", flagEmoji: "🇨🇱" },
  { name: "China", code: "CN", dialCode: "+86", flagEmoji: "🇨🇳" },
  { name: "Colombia", code: "CO", dialCode: "+57", flagEmoji: "🇨🇴" },
  { name: "Comoros", code: "KM", dialCode: "+269", flagEmoji: "🇰🇲" },
  { name: "Congo (Brazzaville)", code: "CG", dialCode: "+242", flagEmoji: "🇨🇬" },
  { name: "Congo (Kinshasa)", code: "CD", dialCode: "+243", flagEmoji: "🇨🇩" },
  { name: "Costa Rica", code: "CR", dialCode: "+506", flagEmoji: "🇨🇷" },
  { name: "Croatia", code: "HR", dialCode: "+385", flagEmoji: "🇭🇷" },
  { name: "Cuba", code: "CU", dialCode: "+53", flagEmoji: "🇨🇺" },
  { name: "Cyprus", code: "CY", dialCode: "+357", flagEmoji: "🇨🇾" },
  { name: "Czech Republic", code: "CZ", dialCode: "+420", flagEmoji: "🇨🇿" },
  { name: "Denmark", code: "DK", dialCode: "+45", flagEmoji: "🇩🇰" },
  { name: "Djibouti", code: "DJ", dialCode: "+253", flagEmoji: "🇩🇯" },
  { name: "Dominica", code: "DM", dialCode: "+1767", flagEmoji: "🇩🇲" },
  { name: "Dominican Republic", code: "DO", dialCode: "+1809", flagEmoji: "🇩🇴" },
  { name: "Ecuador", code: "EC", dialCode: "+593", flagEmoji: "🇪🇨" },
  { name: "Egypt", code: "EG", dialCode: "+20", flagEmoji: "🇪🇬" },
  { name: "El Salvador", code: "SV", dialCode: "+503", flagEmoji: "🇸🇻" },
  { name: "Equatorial Guinea", code: "GQ", dialCode: "+240", flagEmoji: "🇬🇶" },
  { name: "Eritrea", code: "ER", dialCode: "+291", flagEmoji: "🇪🇷" },
  { name: "Estonia", code: "EE", dialCode: "+372", flagEmoji: "🇪🇪" },
  { name: "Eswatini", code: "SZ", dialCode: "+268", flagEmoji: "🇸🇿" },
  { name: "Ethiopia", code: "ET", dialCode: "+251", flagEmoji: "🇪🇹" },
  { name: "Fiji", code: "FJ", dialCode: "+679", flagEmoji: "🇫🇯" },
  { name: "Finland", code: "FI", dialCode: "+358", flagEmoji: "🇫🇮" },
  { name: "France", code: "FR", dialCode: "+33", flagEmoji: "🇫🇷" },
  { name: "Gabon", code: "GA", dialCode: "+241", flagEmoji: "🇬🇦" },
  { name: "Gambia", code: "GM", dialCode: "+220", flagEmoji: "🇬🇲" },
  { name: "Georgia", code: "GE", dialCode: "+995", flagEmoji: "🇬🇪" },
  { name: "Germany", code: "DE", dialCode: "+49", flagEmoji: "🇩🇪" },
  { name: "Greece", code: "GR", dialCode: "+30", flagEmoji: "🇬🇷" },
  { name: "Grenada", code: "GD", dialCode: "+1473", flagEmoji: "🇬🇩" },
  { name: "Guatemala", code: "GT", dialCode: "+502", flagEmoji: "🇬🇹" },
  { name: "Guinea-Bissau", code: "GW", dialCode: "+245", flagEmoji: "🇬🇼" },
  { name: "Guyana", code: "GY", dialCode: "+592", flagEmoji: "🇬🇾" },
  { name: "Haiti", code: "HT", dialCode: "+509", flagEmoji: "🇭🇹" },
  { name: "Honduras", code: "HN", dialCode: "+504", flagEmoji: "🇭🇳" },
  { name: "Hong Kong", code: "HK", dialCode: "+852", flagEmoji: "🇭🇰" },
  { name: "Hungary", code: "HU", dialCode: "+36", flagEmoji: "🇭🇺" },
  { name: "Iceland", code: "IS", dialCode: "+354", flagEmoji: "🇮🇸" },
  { name: "Indonesia", code: "ID", dialCode: "+62", flagEmoji: "🇮🇩" },
  { name: "Iran", code: "IR", dialCode: "+98", flagEmoji: "🇮🇷" },
  { name: "Iraq", code: "IQ", dialCode: "+964", flagEmoji: "🇮🇶" },
  { name: "Ireland", code: "IE", dialCode: "+353", flagEmoji: "🇮🇪" },
  { name: "Israel", code: "IL", dialCode: "+972", flagEmoji: "🇮🇱" },
  { name: "Italy", code: "IT", dialCode: "+39", flagEmoji: "🇮🇹" },
  { name: "Ivory Coast", code: "CI", dialCode: "+225", flagEmoji: "🇨🇮" },
  { name: "Jamaica", code: "JM", dialCode: "+1876", flagEmoji: "🇯🇲" },
  { name: "Japan", code: "JP", dialCode: "+81", flagEmoji: "🇯🇵" },
  { name: "Jordan", code: "JO", dialCode: "+962", flagEmoji: "🇯🇴" },
  { name: "Kazakhstan", code: "KZ", dialCode: "+7", flagEmoji: "🇰🇿" },
  { name: "Kenya", code: "KE", dialCode: "+254", flagEmoji: "🇰🇪" },
  { name: "Kuwait", code: "KW", dialCode: "+965", flagEmoji: "🇰🇼" },
  { name: "Kyrgyzstan", code: "KG", dialCode: "+996", flagEmoji: "🇰🇬" },
  { name: "Laos", code: "LA", dialCode: "+856", flagEmoji: "🇱🇦" },
  { name: "Latvia", code: "LV", dialCode: "+371", flagEmoji: "🇱🇻" },
  { name: "Lebanon", code: "LB", dialCode: "+961", flagEmoji: "🇱🇧" },
  { name: "Lesotho", code: "LS", dialCode: "+266", flagEmoji: "🇱🇸" },
  { name: "Libya", code: "LY", dialCode: "+218", flagEmoji: "🇱🇾" },
  { name: "Liechtenstein", code: "LI", dialCode: "+423", flagEmoji: "🇱🇮" },
  { name: "Lithuania", code: "LT", dialCode: "+370", flagEmoji: "🇱🇹" },
  { name: "Luxembourg", code: "LU", dialCode: "+352", flagEmoji: "🇱🇺" },
  { name: "Madagascar", code: "MG", dialCode: "+261", flagEmoji: "🇲🇬" },
  { name: "Malawi", code: "MW", dialCode: "+265", flagEmoji: "🇲🇼" },
  { name: "Malaysia", code: "MY", dialCode: "+60", flagEmoji: "🇲🇾" },
  { name: "Maldives", code: "MV", dialCode: "+960", flagEmoji: "🇲🇻" },
  { name: "Mali", code: "ML", dialCode: "+223", flagEmoji: "🇲🇱" },
  { name: "Malta", code: "MT", dialCode: "+356", flagEmoji: "🇲🇹" },
  { name: "Mauritania", code: "MR", dialCode: "+222", flagEmoji: "🇲🇷" },
  { name: "Mauritius", code: "MU", dialCode: "+230", flagEmoji: "🇲🇺" },
  { name: "Mexico", code: "MX", dialCode: "+52", flagEmoji: "🇲🇽" },
  { name: "Moldova", code: "MD", dialCode: "+373", flagEmoji: "🇲🇩" },
  { name: "Monaco", code: "MC", dialCode: "+377", flagEmoji: "🇲🇨" },
  { name: "Mongolia", code: "MN", dialCode: "+976", flagEmoji: "🇲🇳" },
  { name: "Montenegro", code: "ME", dialCode: "+382", flagEmoji: "🇲🇪" },
  { name: "Morocco", code: "MA", dialCode: "+212", flagEmoji: "🇲🇦" },
  { name: "Mozambique", code: "MZ", dialCode: "+258", flagEmoji: "🇲🇿" },
  { name: "Myanmar", code: "MM", dialCode: "+95", flagEmoji: "🇲🇲" },
  { name: "Namibia", code: "NA", dialCode: "+264", flagEmoji: "🇳🇦" },
  { name: "Nepal", code: "NP", dialCode: "+977", flagEmoji: "🇳🇵" },
  { name: "Netherlands", code: "NL", dialCode: "+31", flagEmoji: "🇳🇱" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flagEmoji: "🇳🇿" },
  { name: "Nicaragua", code: "NI", dialCode: "+505", flagEmoji: "🇳🇮" },
  { name: "Niger", code: "NE", dialCode: "+227", flagEmoji: "🇳🇪" },
  { name: "North Korea", code: "KP", dialCode: "+850", flagEmoji: "🇰🇵" },
  { name: "North Macedonia", code: "MK", dialCode: "+389", flagEmoji: "🇲🇰" },
  { name: "Norway", code: "NO", dialCode: "+47", flagEmoji: "🇳🇴" },
  { name: "Oman", code: "OM", dialCode: "+968", flagEmoji: "🇴🇲" },
  { name: "Pakistan", code: "PK", dialCode: "+92", flagEmoji: "🇵🇰" },
  { name: "Panama", code: "PA", dialCode: "+507", flagEmoji: "🇵🇦" },
  { name: "Papua New Guinea", code: "PG", dialCode: "+675", flagEmoji: "🇵🇬" },
  { name: "Paraguay", code: "PY", dialCode: "+595", flagEmoji: "🇵🇾" },
  { name: "Peru", code: "PE", dialCode: "+51", flagEmoji: "🇵🇪" },
  { name: "Philippines", code: "PH", dialCode: "+63", flagEmoji: "🇵🇭" },
  { name: "Poland", code: "PL", dialCode: "+48", flagEmoji: "🇵🇱" },
  { name: "Portugal", code: "PT", dialCode: "+351", flagEmoji: "🇵🇹" },
  { name: "Qatar", code: "QA", dialCode: "+974", flagEmoji: "🇶🇦" },
  { name: "Romania", code: "RO", dialCode: "+40", flagEmoji: "🇷🇴" },
  { name: "Russia", code: "RU", dialCode: "+7", flagEmoji: "🇷🇺" },
  { name: "Rwanda", code: "RW", dialCode: "+250", flagEmoji: "🇷🇼" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", flagEmoji: "🇸🇦" },
  { name: "Senegal", code: "SN", dialCode: "+221", flagEmoji: "🇸🇳" },
  { name: "Serbia", code: "RS", dialCode: "+381", flagEmoji: "🇷🇸" },
  { name: "Seychelles", code: "SC", dialCode: "+248", flagEmoji: "🇸🇨" },
  { name: "Singapore", code: "SG", dialCode: "+65", flagEmoji: "🇸🇬" },
  { name: "Slovakia", code: "SK", dialCode: "+421", flagEmoji: "🇸🇰" },
  { name: "Slovenia", code: "SI", dialCode: "+386", flagEmoji: "🇸🇮" },
  { name: "Somalia", code: "SO", dialCode: "+252", flagEmoji: "🇸🇴" },
  { name: "South Africa", code: "ZA", dialCode: "+27", flagEmoji: "🇿🇦" },
  { name: "South Korea", code: "KR", dialCode: "+82", flagEmoji: "🇰🇷" },
  { name: "South Sudan", code: "SS", dialCode: "+211", flagEmoji: "🇸🇸" },
  { name: "Spain", code: "ES", dialCode: "+34", flagEmoji: "🇪🇸" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94", flagEmoji: "🇱🇰" },
  { name: "Sudan", code: "SD", dialCode: "+249", flagEmoji: "🇸🇩" },
  { name: "Suriname", code: "SR", dialCode: "+597", flagEmoji: "🇸🇷" },
  { name: "Sweden", code: "SE", dialCode: "+46", flagEmoji: "🇸🇪" },
  { name: "Switzerland", code: "CH", dialCode: "+41", flagEmoji: "🇨🇭" },
  { name: "Syria", code: "SY", dialCode: "+963", flagEmoji: "🇸🇾" },
  { name: "Taiwan", code: "TW", dialCode: "+886", flagEmoji: "🇹🇼" },
  { name: "Tajikistan", code: "TJ", dialCode: "+992", flagEmoji: "🇹🇯" },
  { name: "Tanzania", code: "TZ", dialCode: "+255", flagEmoji: "🇹🇿" },
  { name: "Thailand", code: "TH", dialCode: "+66", flagEmoji: "🇹🇭" },
  { name: "Togo", code: "TG", dialCode: "+228", flagEmoji: "🇹🇬" },
  { name: "Trinidad and Tobago", code: "TT", dialCode: "+1868", flagEmoji: "🇹🇹" },
  { name: "Tunisia", code: "TN", dialCode: "+216", flagEmoji: "🇹🇳" },
  { name: "Turkey", code: "TR", dialCode: "+90", flagEmoji: "🇹🇷" },
  { name: "Turkmenistan", code: "TM", dialCode: "+993", flagEmoji: "🇹🇲" },
  { name: "Uganda", code: "UG", dialCode: "+256", flagEmoji: "🇺🇬" },
  { name: "Ukraine", code: "UA", dialCode: "+380", flagEmoji: "🇺🇦" },
  { name: "Uruguay", code: "UY", dialCode: "+598", flagEmoji: "🇺🇾" },
  { name: "Uzbekistan", code: "UZ", dialCode: "+998", flagEmoji: "🇺🇿" },
  { name: "Venezuela", code: "VE", dialCode: "+58", flagEmoji: "🇻🇪" },
  { name: "Vietnam", code: "VN", dialCode: "+84", flagEmoji: "🇻🇳" },
  { name: "Yemen", code: "YE", dialCode: "+967", flagEmoji: "🇾🇪" },
  { name: "Zambia", code: "ZM", dialCode: "+260", flagEmoji: "🇿🇲" },
  { name: "Zimbabwe", code: "ZW", dialCode: "+263", flagEmoji: "🇿🇼" },
]

/**
 * Standard default country for this application.
 */
export const DEFAULT_COUNTRY: Country = COUNTRIES[0] // Sierra Leone (+232)

/**
 * Finds a country by dial code (e.g. "+232", "232", "+91").
 */
export function findCountryByDialCode(dialCode?: string | null): Country | undefined {
  if (!dialCode) return undefined
  const cleaned = dialCode.trim()
  const formatted = cleaned.startsWith("+") ? cleaned : `+${cleaned}`

  // Try exact match first
  const exact = COUNTRIES.find((c) => c.dialCode === formatted)
  if (exact) return exact

  // Try digits-only match
  const digits = cleaned.replace(/\D/g, "")
  if (!digits) return undefined
  return COUNTRIES.find((c) => c.dialCode.replace(/\D/g, "") === digits)
}

/**
 * Finds a country by 2-letter ISO code (e.g. "SL", "IN", "US").
 */
export function findCountryByCode(code?: string | null): Country | undefined {
  if (!code) return undefined
  const upper = code.trim().toUpperCase()
  return COUNTRIES.find((c) => c.code.toUpperCase() === upper)
}

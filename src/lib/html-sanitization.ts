/**
 * Sanitizes input string to prevent HTML injection.
 * Strips HTML tags and encodes < and >.
 */
export function sanitizeInput(value: any): string {
  if (typeof value !== "string") {
    return ""
  }
  // Strip HTML tags using regex
  let cleaned = value.replace(/<[^>]*>/g, "")
  // Encode any remaining angle brackets to prevent tag reconstruction
  cleaned = cleaned.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return cleaned.trim()
}

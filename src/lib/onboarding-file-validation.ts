/**
 * Onboarding File Validation Utility
 *
 * Enforces that ONLY images (JPEG, PNG, WebP, GIF, etc.) and PDF documents
 * are allowed for onboarding uploads across all seller panels and rider apps.
 * Strictly blocks Word (.doc, .docx), Excel (.xls, .xlsx, .csv), and other arbitrary formats
 * to prevent browser freezing, memory spikes, and decoding errors.
 */

export const ALLOWED_DOC_ACCEPT = ".pdf,image/*,.jpg,.jpeg,.png,.webp,.gif"
export const ALLOWED_IMAGE_ONLY_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp"

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tiff",
  ".tif",
  ".heic",
  ".heif",
  ".avif",
])

const BLOCKED_OFFICE_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".dot",
  ".dotx",
  ".docm",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".xlsb",
  ".csv",
  ".ppt",
  ".pptx",
  ".pptm",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".txt",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".xml",
  ".html",
  ".htm",
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".js",
  ".ts",
])

export interface FileValidationResult {
  isValid: boolean
  error?: string
}

export interface ValidateOnboardingFileOptions {
  /** If true, only images are allowed (no PDFs). Use for profile photos, selfie, store logo, etc. */
  imagesOnly?: boolean
  /** Maximum file size in MB. Defaults to 4.5MB */
  maxSizeMb?: number
}

/**
 * Checks if a filename has an allowed extension.
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1) return ""
  return filename.slice(lastDot).toLowerCase()
}

/**
 * Validates a file for onboarding upload.
 * Returns `{ isValid: true }` if allowed, or `{ isValid: false, error: "..." }` with a clean error message.
 */
export function validateOnboardingFile(
  file: { name: string; type?: string; size?: number } | null | undefined,
  options: ValidateOnboardingFileOptions = {}
): FileValidationResult {
  if (!file) {
    return { isValid: false, error: "No file provided" }
  }

  const { imagesOnly = false, maxSizeMb = 4.5 } = options
  const filename = file.name || ""
  const ext = getFileExtension(filename)
  const mimeType = (file.type || "").toLowerCase().trim()

  // 1. Explicitly check blocked office/executable extensions
  if (BLOCKED_OFFICE_EXTENSIONS.has(ext)) {
    if (ext === ".doc" || ext === ".docx") {
      return {
        isValid: false,
        error: "Word documents (.doc, .docx) are not allowed. Please upload a PDF or an Image file.",
      }
    }
    if (ext === ".xls" || ext === ".xlsx" || ext === ".csv") {
      return {
        isValid: false,
        error: "Excel spreadsheets (.xls, .xlsx, .csv) are not allowed. Please upload a PDF or an Image file.",
      }
    }
    return {
      isValid: false,
      error: `File type "${ext}" is not allowed. Only PDF and image files are accepted.`,
    }
  }

  // 2. Explicitly block SVGs due to XSS vulnerability
  if (ext === ".svg" || mimeType === "image/svg+xml") {
    return {
      isValid: false,
      error: "SVG image files are not allowed for security reasons. Please upload JPG, PNG, WebP, or PDF.",
    }
  }

  // 3. Check if file is a PDF
  const isPdf = ext === ".pdf" || mimeType === "application/pdf"
  if (isPdf) {
    if (imagesOnly) {
      return {
        isValid: false,
        error: "PDF documents are not allowed for this field. Please upload an image file (JPG, PNG, WebP).",
      }
    }
  }

  // 4. Check if file is an allowed image
  const isImage =
    ALLOWED_IMAGE_EXTENSIONS.has(ext) ||
    (mimeType.startsWith("image/") && mimeType !== "image/svg+xml")

  // Must be either PDF (if allowed) or Image
  if (!isPdf && !isImage) {
    return {
      isValid: false,
      error: imagesOnly
        ? "Only image files (JPG, PNG, WebP, etc.) are allowed. Rest nothing is accepted."
        : "Only PDF documents and image files (JPG, PNG, WebP, etc.) are allowed. Rest nothing is accepted.",
    }
  }

  // 5. File size check
  if (file.size && file.size > maxSizeMb * 1024 * 1024) {
    return {
      isValid: false,
      error: `File size exceeds ${maxSizeMb} MB limit. Please select or compress a smaller file.`,
    }
  }

  return { isValid: true }
}

/**
 * Robustly checks if a URL represents a PDF document,
 * including signed S3 URLs with query parameters.
 */
export function isPdfUrl(url?: string | null): boolean {
  if (!url) return false
  return /\.pdf($|\?|#)/i.test(url)
}

/**
 * Robustly checks if a URL represents an image,
 * including signed S3 URLs with query parameters.
 */
export function isImageUrl(url?: string | null): boolean {
  if (!url) return false
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tif|tiff)($|\?|#)/i.test(url)
}

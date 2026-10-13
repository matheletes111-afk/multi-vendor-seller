/**
 * Automated Test Suite: HEIC Detection, File Validation, Size Constraints, and 413 Handling
 * Run with: pnpm exec tsx scripts/test-heic-and-validation.ts
 */

import {
  validateOnboardingFile,
  isImageFile,
  isPdfUrl,
  isImageUrl,
  ALLOWED_DOC_ACCEPT,
  ALLOWED_IMAGE_ONLY_ACCEPT,
} from "../src/lib/onboarding-file-validation"

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, extraInfo = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${testName} ${extraInfo}`)
    failed++
  }
}

// Helper to construct binary ISOBMFF header for HEIC
function createBinaryHeicHeader(majorBrand: string, compatibleBrands: string[] = []): Uint8Array {
  // Box size: 4 bytes length, 4 bytes 'ftyp', 4 bytes majorBrand, 4 bytes minorVersion, then 4 bytes per compatibleBrand
  const totalLength = 16 + compatibleBrands.length * 4
  const buffer = new Uint8Array(totalLength)
  const view = new DataView(buffer.buffer)

  view.setUint32(0, totalLength, false) // Big endian length
  // 'ftyp'
  buffer[4] = 0x66
  buffer[5] = 0x74
  buffer[6] = 0x79
  buffer[7] = 0x70

  // Major brand
  for (let i = 0; i < 4; i++) {
    buffer[8 + i] = majorBrand.charCodeAt(i) || 0x20
  }

  // Minor version (0)
  view.setUint32(12, 0, false)

  // Compatible brands
  let offset = 16
  for (const brand of compatibleBrands) {
    for (let i = 0; i < 4; i++) {
      buffer[offset + i] = brand.charCodeAt(i) || 0x20
    }
    offset += 4
  }

  return buffer
}

function checkHeicHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const ftyp = String.fromCharCode(...bytes.slice(4, 8))
  if (ftyp !== "ftyp") return false
  const major = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase()
  const heicBrands = ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]
  if (heicBrands.includes(major)) return true

  // Check compatible brands
  for (let i = 16; i + 4 <= bytes.length; i += 4) {
    const brand = String.fromCharCode(...bytes.slice(i, i + 4)).toLowerCase()
    if (heicBrands.includes(brand)) return true
  }
  return false
}

console.log("\n==========================================")
console.log("TEST SUITE 1: Binary Header HEIC Detection")
console.log("==========================================")

{
  const heicHeader = createBinaryHeicHeader("heic")
  assert(checkHeicHeader(heicHeader), "Detects 'ftypheic' major brand")

  const mif1Header = createBinaryHeicHeader("mif1", ["heic", "msf1"])
  assert(checkHeicHeader(mif1Header), "Detects 'ftypmif1' with 'heic' compatible brand")

  const hevcHeader = createBinaryHeicHeader("hevc")
  assert(checkHeicHeader(hevcHeader), "Detects 'ftyphevc' iPhone video/photo brand")

  // Non-HEIC headers
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
  assert(!checkHeicHeader(jpegHeader), "Correctly rejects JPEG JFIF header")

  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
  assert(!checkHeicHeader(pngHeader), "Correctly rejects PNG header")
}

console.log("\n==========================================")
console.log("TEST SUITE 2: Onboarding File Validation")
console.log("==========================================")

{
  // 1. HEIC file acceptance
  const heicFile = { name: "IMG_5839.HEIC", type: "image/heic", size: 14 * 1024 * 1024 }
  const res1 = validateOnboardingFile(heicFile, { isPreCompression: true })
  assert(res1.isValid, "Accepts 14MB iPhone HEIC file before client-side compression")

  // 2. iPhone HEIC with empty MIME type (common Safari quirk)
  const heicEmptyMime = { name: "photo_2026.heic", type: "", size: 18 * 1024 * 1024 }
  const res2 = validateOnboardingFile(heicEmptyMime, { isPreCompression: true })
  assert(res2.isValid, "Accepts iPhone HEIC with empty MIME type (Safari quirk)")

  // 3. iPhone HEIC with octet-stream MIME type
  const heicOctet = { name: "IMG_9999.HEIF", type: "application/octet-stream", size: 12 * 1024 * 1024 }
  const res3 = validateOnboardingFile(heicOctet, { isPreCompression: true })
  assert(res3.isValid, "Accepts iPhone HEIF with application/octet-stream")

  // 4. Large 20MB high-res Android photo
  const androidJpg = { name: "DCIM_20261013.jpg", type: "image/jpeg", size: 20 * 1024 * 1024 }
  const res4 = validateOnboardingFile(androidJpg, { isPreCompression: true })
  assert(res4.isValid, "Accepts 20MB Android JPEG photo before compression")

  // 5. Extremely oversized file (> 50MB) rejection
  const hugeFile = { name: "huge_photo.heic", type: "image/heic", size: 55 * 1024 * 1024 }
  const res5 = validateOnboardingFile(hugeFile, { isPreCompression: true })
  assert(!res5.isValid, "Rejects absurdly oversized 55MB image file")

  // 6. Blocked Word document
  const wordDoc = { name: "business_plan.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024 * 1024 }
  const res6 = validateOnboardingFile(wordDoc)
  assert(!res6.isValid && (res6.error?.includes("Word documents") ?? false), "Blocks .docx Word document with specific message")

  // 7. Blocked Excel spreadsheet
  const excelDoc = { name: "tax_records.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 500 * 1024 }
  const res7 = validateOnboardingFile(excelDoc)
  assert(!res7.isValid && (res7.error?.includes("Excel spreadsheets") ?? false), "Blocks .xlsx Excel file with specific message")

  // 8. Blocked SVG due to XSS vulnerability
  const svgDoc = { name: "logo.svg", type: "image/svg+xml", size: 100 * 1024 }
  const res8 = validateOnboardingFile(svgDoc)
  assert(!res8.isValid && (res8.error?.includes("SVG image files are not allowed") ?? false), "Blocks SVG image for security")

  // 9. Valid PDF document
  const validPdf = { name: "registration_cert.pdf", type: "application/pdf", size: 2 * 1024 * 1024 }
  const res9 = validateOnboardingFile(validPdf)
  assert(res9.isValid, "Accepts valid 2MB PDF document")

  // 10. PDF rejection when imagesOnly: true (e.g. profile picture or selfie)
  const pdfForAvatar = { name: "my_face.pdf", type: "application/pdf", size: 1024 * 1024 }
  const res10 = validateOnboardingFile(pdfForAvatar, { imagesOnly: true })
  assert(!res10.isValid && (res10.error?.includes("PDF documents are not allowed") ?? false), "Rejects PDF when field is imagesOnly")

  // 11. PDF exceeding 4.5MB limit
  const largePdf = { name: "huge_scan.pdf", type: "application/pdf", size: 6 * 1024 * 1024 }
  const res11 = validateOnboardingFile(largePdf, { maxSizeMb: 4.5 })
  assert(!res11.isValid, "Rejects PDF exceeding 4.5MB limit")
}

console.log("\n==========================================")
console.log("TEST SUITE 3: URL & MIME Type Helpers")
console.log("==========================================")

{
  assert(isPdfUrl("https://example.com/uploads/doc.pdf"), "isPdfUrl matches .pdf url")
  assert(isPdfUrl("https://example.com/uploads/doc.PDF?token=123"), "isPdfUrl handles uppercase .PDF with query string")
  assert(!isPdfUrl("https://example.com/uploads/image.jpg"), "isPdfUrl rejects .jpg")

  assert(isImageUrl("https://example.com/uploads/avatar.webp"), "isImageUrl matches .webp")
  assert(isImageUrl("https://example.com/uploads/photo.heic"), "isImageUrl matches .heic")
  assert(isImageUrl("https://example.com/uploads/photo.HEIC?v=1"), "isImageUrl matches .HEIC with query")
  assert(!isImageUrl("https://example.com/uploads/doc.pdf"), "isImageUrl rejects .pdf")

  assert(isImageFile({ name: "test.HEIC" }), "isImageFile recognizes .HEIC")
  assert(isImageFile({ name: "test.avif" }), "isImageFile recognizes .avif")
  assert(isImageFile({ name: "photo", type: "image/webp" }), "isImageFile recognizes type image/webp")
  assert(!isImageFile({ name: "doc.docx" }), "isImageFile rejects .docx")
}

console.log("\n==========================================")
console.log("TEST SUITE 4: Status 413 Error Message Handling")
console.log("==========================================")

{
  // Test formatting for Status 413
  function formatErrorMessage(errMessage: string): string {
    let msg = errMessage || "An unexpected error occurred. Please try again."
    if (msg.includes("413") || msg.includes("too large") || msg.includes("Payload Too Large")) {
      return "Uploaded file exceeds the maximum allowed server limit (Status 413). Please choose a smaller file or ensure your documents are under 4.5 MB, then try again."
    } else if (msg.includes("Failed to fetch") || msg.includes("Load failed") || msg.includes("NetworkError")) {
      return "Upload failed (Network/File Size issue). Please ensure each uploaded document or photo is under 4.5 MB and your connection is stable, then try again."
    }
    return msg
  }

  const msg413 = formatErrorMessage("Failed to upload documents. Please try again. (Status: 413)")
  assert(
    msg413.includes("maximum allowed server limit (Status 413)"),
    "Translates raw Status: 413 into user-actionable guidance"
  )

  const msgPayload = formatErrorMessage("Request entity too large: Payload Too Large")
  assert(
    msgPayload.includes("maximum allowed server limit (Status 413)"),
    "Translates Payload Too Large into user-actionable guidance"
  )

  const msgNetwork = formatErrorMessage("TypeError: Failed to fetch")
  assert(
    msgNetwork.includes("Upload failed (Network/File Size issue)"),
    "Translates Failed to fetch into clear network/size issue message"
  )
}

console.log("\n==========================================")
console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`)
console.log("==========================================\n")

if (failed > 0) {
  process.exit(1)
} else {
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!")
}

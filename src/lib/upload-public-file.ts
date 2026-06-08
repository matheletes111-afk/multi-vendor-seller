import { randomUUID } from "crypto"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

type UploadArgs = {
  /** Folder prefix in storage, e.g. "categories" or "subcategories" */
  folder: string
  /** File extension including dot, e.g. ".png" */
  ext: string
  /** Content type, e.g. "image/png" */
  contentType: string
  /** File bytes */
  buffer: Buffer
  /** Optional stable prefix for name */
  prefix: string
}

function validateFileSignature(buffer: Buffer, ext: string, contentType: string): void {
  const cleanExt = ext.toLowerCase().trim()
  const cleanType = contentType.toLowerCase().trim()

  const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov", ".pdf"]
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/pdf",
  ]

  if (!allowedExts.includes(cleanExt)) {
    throw new Error(`Disallowed file extension: ${cleanExt}`)
  }
  if (!allowedTypes.includes(cleanType)) {
    throw new Error(`Disallowed content type: ${cleanType}`)
  }

  // Magic bytes checks
  if (cleanExt === ".jpg" || cleanExt === ".jpeg") {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new Error("Invalid JPEG signature")
    }
  } else if (cleanExt === ".png") {
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47 ||
      buffer[4] !== 0x0d ||
      buffer[5] !== 0x0a ||
      buffer[6] !== 0x1a ||
      buffer[7] !== 0x0a
    ) {
      throw new Error("Invalid PNG signature")
    }
  } else if (cleanExt === ".gif") {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x47 ||
      buffer[1] !== 0x49 ||
      buffer[2] !== 0x46 ||
      buffer[3] !== 0x38
    ) {
      throw new Error("Invalid GIF signature")
    }
  } else if (cleanExt === ".webp") {
    if (
      buffer.length < 12 ||
      buffer[0] !== 0x52 ||
      buffer[1] !== 0x49 ||
      buffer[2] !== 0x46 ||
      buffer[3] !== 0x46 ||
      buffer[8] !== 0x57 ||
      buffer[9] !== 0x45 ||
      buffer[10] !== 0x42 ||
      buffer[11] !== 0x50
    ) {
      throw new Error("Invalid WebP signature")
    }
  } else if (cleanExt === ".pdf") {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x25 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x44 ||
      buffer[3] !== 0x46
    ) {
      throw new Error("Invalid PDF signature")
    }
  } else if (cleanExt === ".mp4") {
    if (
      buffer.length < 8 ||
      buffer[4] !== 0x66 ||
      buffer[5] !== 0x74 ||
      buffer[6] !== 0x79 ||
      buffer[7] !== 0x70
    ) {
      throw new Error("Invalid MP4 signature")
    }
  } else if (cleanExt === ".webm") {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x1a ||
      buffer[1] !== 0x45 ||
      buffer[2] !== 0xdf ||
      buffer[3] !== 0xa3
    ) {
      throw new Error("Invalid WebM signature")
    }
  } else if (cleanExt === ".mov") {
    if (buffer.length < 8) {
      throw new Error("Invalid QuickTime signature")
    }
    const isFtyp = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
    const isMoov = buffer[4] === 0x6d && buffer[5] === 0x6f && buffer[6] === 0x6f && buffer[7] === 0x76
    const isMdat = buffer[4] === 0x6d && buffer[5] === 0x64 && buffer[6] === 0x61 && buffer[7] === 0x74
    const isWide = buffer[4] === 0x77 && buffer[5] === 0x69 && buffer[6] === 0x64 && buffer[7] === 0x65
    const isFree = buffer[4] === 0x66 && buffer[5] === 0x72 && buffer[6] === 0x65 && buffer[7] === 0x65
    if (!isFtyp && !isMoov && !isMdat && !isWide && !isFree) {
      throw new Error("Invalid QuickTime signature")
    }
  }
}

/**
 * Strip EXIF / IPTC / XMP metadata from image buffers before upload. (Issue #17)
 * - JPEG: removes APP1 (EXIF/XMP), APP2 (ICC/Flashpix), APP13 (IPTC) marker segments.
 * - PNG:  removes tEXt, zTXt, iTXt, eXIf ancillary chunks.
 * - All other types (video, PDF, GIF, WebP): returned unchanged.
 * Pure Node.js Buffer manipulation — zero external dependencies.
 */
function stripImageMetadata(buffer: Buffer, ext: string): Buffer {
  const cleanExt = ext.toLowerCase()

  // ── JPEG ─────────────────────────────────────────────────────────────────
  if (cleanExt === ".jpg" || cleanExt === ".jpeg") {
    const out: Buffer[] = []
    let i = 0

    // JPEG starts with SOI marker FF D8
    if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer
    out.push(buffer.subarray(0, 2))
    i = 2

    while (i < buffer.length - 1) {
      if (buffer[i] !== 0xff) break // malformed — stop stripping, keep rest as-is

      const marker = buffer[i + 1]

      // SOS (Start Of Scan) — image data follows; copy remainder verbatim
      if (marker === 0xda) {
        out.push(buffer.subarray(i))
        break
      }

      // EOI or standalone markers with no length field
      if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        out.push(buffer.subarray(i, i + 2))
        i += 2
        continue
      }

      if (i + 4 > buffer.length) break
      const segLen = buffer.readUInt16BE(i + 2) // length includes the 2-byte length field
      const segEnd = i + 2 + segLen

      // APP1 (0xe1) — EXIF / XMP
      // APP2 (0xe2) — ICC / Flashpix extended
      // APP13 (0xed) — IPTC / Photoshop
      const isMetaMarker = marker === 0xe1 || marker === 0xe2 || marker === 0xed

      if (!isMetaMarker) {
        // Keep this segment
        out.push(buffer.subarray(i, segEnd))
      }
      // else: skip (strip) the metadata segment

      i = segEnd
    }

    return Buffer.concat(out)
  }

  // ── PNG ───────────────────────────────────────────────────────────────────
  if (cleanExt === ".png") {
    // PNG signature is 8 bytes
    if (buffer.length < 8) return buffer

    const PNG_SIG_LEN = 8
    const out: Buffer[] = [buffer.subarray(0, PNG_SIG_LEN)]
    let i = PNG_SIG_LEN

    // Chunk types whose presence leaks metadata; strip them
    const META_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf"])

    while (i + 12 <= buffer.length) {
      const dataLen = buffer.readUInt32BE(i)            // 4 bytes
      const chunkType = buffer.subarray(i + 4, i + 8).toString("ascii") // 4 bytes
      const totalChunk = 4 + 4 + dataLen + 4           // length + type + data + CRC

      if (i + totalChunk > buffer.length) break        // malformed, stop

      if (!META_CHUNKS.has(chunkType)) {
        out.push(buffer.subarray(i, i + totalChunk))
      }
      // else: strip metadata chunk

      i += totalChunk

      // IEND marks the end of the PNG stream
      if (chunkType === "IEND") break
    }

    return Buffer.concat(out)
  }

  // All other formats — return buffer unchanged
  return buffer
}

/**
 * Upload a file to a public URL.
 *
 * Uploads to AWS S3.
 *
 * Required env vars:
 * - AMPLIFY_AWS_REGION
 * - AMPLIFY_AWS_ACCESS_KEY_ID
 * - AMPLIFY_AWS_SECRET_ACCESS_KEY
 * - S3_BUCKET or AMPLIFY_AWS_S3_BUCKET_NAME
 *
 * Optional:
 * - S3_PUBLIC_BASE_URL (e.g. https://cdn.example.com or https://my-bucket.s3.region.amazonaws.com)
 */
export async function uploadPublicFile(args: UploadArgs): Promise<string> {
  const { folder, ext, contentType, prefix } = args
  let { buffer } = args
  const safeExt = ext && ext.startsWith(".") ? ext : `.${String(ext || "").replace(/^\.+/, "") || "bin"}`

  // Centralized security guard for file validation
  validateFileSignature(buffer, safeExt, contentType)

  // Strip EXIF / IPTC / XMP metadata from image buffers before storage (Issue #17)
  buffer = stripImageMetadata(buffer, safeExt)

  const fileName = `${prefix}-${Date.now()}-${randomUUID()}${safeExt}`

  const region = process.env.AMPLIFY_AWS_REGION
  const bucket = process.env.S3_BUCKET || process.env.AMPLIFY_AWS_S3_BUCKET_NAME
  const accessKeyId = process.env.AMPLIFY_AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      `Missing S3 env vars. Set AMPLIFY_AWS_REGION, AMPLIFY_AWS_S3_BUCKET_NAME, AMPLIFY_AWS_ACCESS_KEY_ID, and AMPLIFY_AWS_SECRET_ACCESS_KEY on the server.`
    )
  }

  const key = `uploads/${folder}/${fileName}`
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`S3 upload failed: ${msg}`)
  }

  const publicBaseUrl = (process.env.S3_PUBLIC_BASE_URL || "").trim()
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`
  }

  // Default public URL format (requires bucket/object to be publicly readable OR served via CDN later).
  // Note: For us-east-1, the regional endpoint still works.
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}


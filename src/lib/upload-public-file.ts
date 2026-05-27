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
  const { folder, ext, contentType, buffer, prefix } = args
  const safeExt = ext && ext.startsWith(".") ? ext : `.${String(ext || "").replace(/^\.+/, "") || "bin"}`
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


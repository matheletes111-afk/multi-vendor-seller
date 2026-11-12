import { S3Client } from "@aws-sdk/client-s3"

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined
}

const region = (
  process.env.AMPLIFY_AWS_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1"
).trim()
const accessKeyId = (
  process.env.AMPLIFY_AWS_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID ||
  ""
).trim()
const secretAccessKey = (
  process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  ""
).trim()

if (!region || !accessKeyId || !secretAccessKey) {
  console.warn(
    "[s3-client] Incomplete S3 credentials: Set AMPLIFY_AWS_REGION/AWS_REGION, AMPLIFY_AWS_ACCESS_KEY_ID/AWS_ACCESS_KEY_ID, and AMPLIFY_AWS_SECRET_ACCESS_KEY/AWS_SECRET_ACCESS_KEY."
  )
}

export const s3Client =
  globalForS3.s3Client ??
  new S3Client({
    region,
    credentials: {
      accessKeyId: accessKeyId || "placeholder",
      secretAccessKey: secretAccessKey || "placeholder",
    },
  })

if (process.env.NODE_ENV !== "production") {
  globalForS3.s3Client = s3Client
}

export const S3_BUCKET_NAME = (
  process.env.S3_BUCKET ||
  process.env.AMPLIFY_AWS_S3_BUCKET_NAME ||
  process.env.AWS_S3_BUCKET_NAME ||
  process.env.AWS_BUCKET ||
  process.env.AWS_S3_BUCKET ||
  ""
).trim()

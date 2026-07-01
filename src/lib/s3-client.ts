import { S3Client } from "@aws-sdk/client-s3"

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined
}

const region = process.env.AMPLIFY_AWS_REGION
const accessKeyId = process.env.AMPLIFY_AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY

if (!region || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "Missing S3 credentials. Set AMPLIFY_AWS_REGION, AMPLIFY_AWS_ACCESS_KEY_ID, and AMPLIFY_AWS_SECRET_ACCESS_KEY."
  )
}

export const s3Client =
  globalForS3.s3Client ??
  new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

if (process.env.NODE_ENV !== "production") {
  globalForS3.s3Client = s3Client
}

export const S3_BUCKET_NAME = process.env.S3_BUCKET || process.env.AMPLIFY_AWS_S3_BUCKET_NAME

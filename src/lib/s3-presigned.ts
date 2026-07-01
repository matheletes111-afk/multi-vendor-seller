"use server"

import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { s3Client, S3_BUCKET_NAME } from "./s3-client"
import { auth } from "./auth"
import { prisma } from "./prisma"
import { UserRole } from "@prisma/client"

/**
 * Validates if the given fileKey is associated with the seller's account.
 */
async function isSellerAuthorizedForFile(userId: string, role: UserRole, fileKey: string): Promise<boolean> {
  const normalizedKey = fileKey.toLowerCase().trim()

  if (role === UserRole.SELLER_HOTEL) {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
      include: {
        businessInfo: true,
        kyc: true,
        bankDetails: true,
      },
    })

    if (!seller) return false

    // Collect all S3 URLs related to this seller
    const urls = [
      seller.logo,
      seller.banner,
      seller.mainPhoto,
      seller.businessInfo?.busRegCertUrl,
      seller.businessInfo?.cityCouncilCertUrl,
      seller.businessInfo?.gstTinCertUrl,
      seller.businessInfo?.addressProofUrl,
      seller.kyc?.idFrontUrl,
      seller.kyc?.idBackUrl,
      seller.kyc?.selfieUrl,
      seller.bankDetails?.passbookUrl,
      seller.bankDetails?.bankLetterUrl,
    ]

    return urls.some((url) => url && url.toLowerCase().includes(normalizedKey))
  }

  if (role === UserRole.SELLER_RESTAURANT) {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
      include: {
        businessInfo: true,
        kyc: true,
        bankDetails: true,
      },
    })

    if (!seller) return false

    const urls = [
      seller.logo,
      seller.banner,
      seller.mainPhoto,
      seller.businessInfo?.busRegCertUrl,
      seller.businessInfo?.cityCouncilCertUrl,
      seller.businessInfo?.gstTinCertUrl,
      seller.businessInfo?.addressProofUrl,
      seller.kyc?.idFrontUrl,
      seller.kyc?.idBackUrl,
      seller.kyc?.selfieUrl,
      seller.kyc?.foodLicenseUrl,
      seller.bankDetails?.passbookUrl,
      seller.bankDetails?.bankLetterUrl,
    ]

    return urls.some((url) => url && url.toLowerCase().includes(normalizedKey))
  }

  if (role === UserRole.SELLER_PRODUCT || role === UserRole.SELLER_SERVICE) {
    const seller = await prisma.seller.findUnique({
      where: { userId },
      include: {
        businessInfo: true,
        kyc: true,
        bankDetails: true,
        store: true,
      },
    })

    if (!seller) return false

    const urls = [
      seller.store?.logo,
      seller.store?.banner,
      seller.businessInfo?.busRegCertUrl,
      seller.businessInfo?.cityCouncilCertUrl,
      seller.businessInfo?.gstTinCertUrl,
      seller.businessInfo?.addressProofUrl,
      seller.kyc?.idFrontUrl,
      seller.kyc?.idBackUrl,
      seller.kyc?.selfieUrl,
      seller.bankDetails?.passbookUrl,
      seller.bankDetails?.bankLetterUrl,
    ]

    return urls.some((url) => url && url.toLowerCase().includes(normalizedKey))
  }

  return false
}

/**
 * Server Action to securely generate a pre-signed GET URL for a private S3 file.
 * The URL expires in 5 minutes (300 seconds).
 *
 * @param fileKey S3 key (e.g. "uploads/restaurant-onboarding/kyc/id_card.jpg")
 * @returns Pre-signed URL or throws error if unauthorized/file not found.
 */
export async function generatePresignedUrl(fileKey: string): Promise<string> {
  if (!fileKey) {
    throw new Error("File key is required")
  }

  // 1. Session Verification
  const session = await auth()
  if (!session?.user || !session.user.id || !session.user.role) {
    throw new Error("Unauthorized: Please log in.")
  }

  const { id: userId, role } = session.user

  // 2. Authorization Check
  const isAdmin = role === UserRole.ADMIN
  if (!isAdmin) {
    // If not admin, check if the seller owns the document
    const isAuthorized = await isSellerAuthorizedForFile(userId, role, fileKey)
    if (!isAuthorized) {
      throw new Error("Unauthorized: You do not have permission to access this file.")
    }
  }

  // 3. Generate Pre-signed URL
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
    })

    const presignedUrl = await getSignedUrl(s3Client as any, command as any, {
      expiresIn: 300, // 5 minutes
    })

    return presignedUrl
  } catch (err: any) {
    console.error("Error generating pre-signed S3 URL:", err)
    throw new Error("Failed to generate secure URL.")
  }
}

/**
 * Parses a standard S3 file URL and generates a pre-signed URL if it matches S3 storage path.
 *
 * @param url Full URL or relative path (e.g. "https://bucket.s3.region.amazonaws.com/uploads/foo.jpg")
 * @returns Pre-signed URL or the original URL if not an S3 upload or generation fails.
 */
export async function getPresignedUrlOrOriginal(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  if (url.includes("X-Amz-Signature")) return url

  const privateFolders = [
    "uploads/restaurant-onboarding/business",
    "uploads/restaurant-onboarding/kyc",
    "uploads/restaurant-onboarding/property",
    "uploads/restaurant-onboarding/bank",
    "uploads/hotel-onboarding/business",
    "uploads/hotel-onboarding/kyc",
    "uploads/hotel-onboarding/property",
    "uploads/hotel-onboarding/bank"
  ]

  const hasPrivateFolder = privateFolders.some(folder => url.includes(folder))
  if (hasPrivateFolder) {
    const uploadsIndex = url.indexOf("uploads/")
    if (uploadsIndex !== -1) {
      const key = url.substring(uploadsIndex)
      try {
        return await generatePresignedUrl(key)
      } catch (e) {
        console.error(`Failed to pre-sign key ${key}:`, e)
        return url
      }
    }
  }
  return url
}


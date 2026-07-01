import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import path from "path"
import bcrypt from "bcryptjs"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"

export const dynamic = 'force-dynamic'

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

/**
 * GET /mobileapi/restaurant-seller/settings
 * Fetch full profile of the restaurant seller.
 */
export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
      include: {
        businessInfo: true,
        kyc: true,
        bankDetails: true,
        agreement: true,
        user: {
          select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
        },
      },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const { getPresignedUrlOrOriginal } = await import("@/lib/s3-presigned")
    seller.logo = await getPresignedUrlOrOriginal(seller.logo)
    seller.banner = await getPresignedUrlOrOriginal(seller.banner)
    seller.mainPhoto = await getPresignedUrlOrOriginal(seller.mainPhoto)

    if (seller.businessInfo) {
      const [busReg, cityCouncil, gstTin, addrProof] = await Promise.all([
        getPresignedUrlOrOriginal(seller.businessInfo.busRegCertUrl),
        getPresignedUrlOrOriginal(seller.businessInfo.cityCouncilCertUrl),
        getPresignedUrlOrOriginal(seller.businessInfo.gstTinCertUrl),
        getPresignedUrlOrOriginal(seller.businessInfo.addressProofUrl)
      ])
      seller.businessInfo.busRegCertUrl = busReg
      seller.businessInfo.cityCouncilCertUrl = cityCouncil
      seller.businessInfo.gstTinCertUrl = gstTin
      seller.businessInfo.addressProofUrl = addrProof
    }

    if (seller.kyc) {
      const [front, back, selfie, license] = await Promise.all([
        getPresignedUrlOrOriginal(seller.kyc.idFrontUrl),
        getPresignedUrlOrOriginal(seller.kyc.idBackUrl),
        getPresignedUrlOrOriginal(seller.kyc.selfieUrl),
        getPresignedUrlOrOriginal(seller.kyc.foodLicenseUrl)
      ])
      seller.kyc.idFrontUrl = front
      seller.kyc.idBackUrl = back
      seller.kyc.selfieUrl = selfie
      seller.kyc.foodLicenseUrl = license
    }

    if (seller.bankDetails) {
      const [passbook, bankLetter] = await Promise.all([
        getPresignedUrlOrOriginal(seller.bankDetails.passbookUrl),
        getPresignedUrlOrOriginal(seller.bankDetails.bankLetterUrl)
      ])
      seller.bankDetails.passbookUrl = passbook
      seller.bankDetails.bankLetterUrl = bankLetter
    }

    return NextResponse.json({ success: true, data: seller })
  } catch (error) {
    console.error("Error in mobile settings GET API:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /mobileapi/restaurant-seller/settings
 * Update settings by section (user, business, kyc, bank, restaurant) via multipart/form-data.
 */
export async function PUT(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
      include: { businessInfo: true, kyc: true, bankDetails: true }
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ success: false, error: "Content-Type must be multipart/form-data" }, { status: 400 })
    }

    const fd = await request.formData()
    const section = fd.get("section") as string

    if (!section) {
      return NextResponse.json({ success: false, error: "section parameter is required" }, { status: 400 })
    }

    // 1. Handle User Profile
    if (section === "user") {
      const name = fd.get("name") !== null ? sanitizeInput(fd.get("name") as string) : undefined
      const phone = (fd.get("phone") as string)?.trim()
      const phoneCountryCode = (fd.get("phoneCountryCode") as string)?.trim()
      const password = (fd.get("password") as string)?.trim()
      const currentPassword = (fd.get("currentPassword") as string)?.trim() || ""
      const profileImageFile = fd.get("profileImage") as File | null

      const userData: any = {}
      if (name) userData.name = name
      if (phone) {
        if (!/^[0-9]+$/.test(phone)) {
          return NextResponse.json({ success: false, error: "Phone number must contain only numbers." }, { status: 400 })
        }
        userData.phone = phone
      }
      if (phoneCountryCode) {
        if (!/^\+?[0-9]+$/.test(phoneCountryCode)) {
          return NextResponse.json({ success: false, error: "Country code must contain only numbers (optionally starting with +)." }, { status: 400 })
        }
        userData.phoneCountryCode = phoneCountryCode
      }
      if (password) {
        const passwordValidation = validatePassword(password)
        if (!passwordValidation.isValid) {
          return NextResponse.json({ success: false, error: passwordValidation.error }, { status: 400 })
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { password: true }
        })
        if (dbUser?.password) {
          if (!currentPassword) {
            return NextResponse.json({ success: false, error: "Current password is required to change password" }, { status: 400 })
          }
          const isPasswordCorrect = await bcrypt.compare(currentPassword, dbUser.password)
          if (!isPasswordCorrect) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 400 })
          }
        }
        userData.password = await bcrypt.hash(password, 10)
      }

      if (profileImageFile && profileImageFile.size > 0) {
        const ext = path.extname(profileImageFile.name) || getImageExtFromContentType(profileImageFile.type)
        userData.image = await uploadPublicFile({
          folder: "profile",
          ext,
          contentType: profileImageFile.type,
          buffer: Buffer.from(await profileImageFile.arrayBuffer()),
          prefix: "profile",
        })
      }

      if (Object.keys(userData).length > 0) {
        await prisma.user.update({ where: { id: userId }, data: userData })
      }
    }

    // 2. Handle Business Info
    else if (section === "business") {
      const businessName = (fd.get("businessName") as string)?.trim()
      const businessType = (fd.get("businessType") as string)?.trim()
      const taxIdNumber = (fd.get("taxIdNumber") as string)?.trim()
      const haveGstRaw = fd.get("haveGst") as string
      const gstInvNo = (fd.get("gstInvNo") as string)?.trim()
      const gstCustomerName = (fd.get("gstCustomerName") as string)?.trim()
      const landmark = (fd.get("landmark") as string)?.trim()
      const city = (fd.get("city") as string)?.trim()
      const district = (fd.get("district") as string)?.trim()
      const state = (fd.get("state") as string)?.trim()
      const busRegCert = fd.get("busRegCert") as File | null
      const cityCouncilCert = fd.get("cityCouncilCert") as File | null
      const gstTinCert = fd.get("gstTinCert") as File | null
      const addressProof = fd.get("addressProof") as File | null

      const managerName = (fd.get("managerName") as string)?.trim()
      const pocContact = (fd.get("pocContact") as string)?.trim()

      const busData: any = {
        businessName, businessType, taxIdNumber, landmark, city, district, state, managerName, pocContact
      }
      if (haveGstRaw !== null) {
        const h = haveGstRaw === "true"
        busData.haveGst = h
        busData.gstInvNo = h ? gstInvNo : null
        busData.gstCustomerName = h ? gstCustomerName : null
      }

      if (busRegCert && busRegCert.size > 0) {
        busData.busRegCertUrl = await uploadPublicFile({
          folder: "restaurant-onboarding/business",
          ext: path.extname(busRegCert.name) || ".pdf",
          contentType: busRegCert.type,
          buffer: Buffer.from(await busRegCert.arrayBuffer()),
          prefix: "restaurant-bus-reg",
        })
      }
      if (cityCouncilCert && cityCouncilCert.size > 0) {
        busData.cityCouncilCertUrl = await uploadPublicFile({
          folder: "restaurant-onboarding/business",
          ext: path.extname(cityCouncilCert.name) || ".pdf",
          contentType: cityCouncilCert.type,
          buffer: Buffer.from(await cityCouncilCert.arrayBuffer()),
          prefix: "restaurant-city-council",
        })
      }
      if (gstTinCert && gstTinCert.size > 0) {
        busData.gstTinCertUrl = await uploadPublicFile({
          folder: "restaurant-onboarding/business",
          ext: path.extname(gstTinCert.name) || ".pdf",
          contentType: gstTinCert.type,
          buffer: Buffer.from(await gstTinCert.arrayBuffer()),
          prefix: "restaurant-gst-tin",
        })
      }
      if (addressProof && addressProof.size > 0) {
        busData.addressProofUrl = await uploadPublicFile({
          folder: "restaurant-onboarding/business",
          ext: path.extname(addressProof.name) || ".pdf",
          contentType: addressProof.type,
          buffer: Buffer.from(await addressProof.arrayBuffer()),
          prefix: "restaurant-address-proof",
        })
      }

      await prisma.restaurantBusinessInfo.upsert({
        where: { restaurantSellerId: seller.id },
        update: busData,
        create: { ...busData, restaurantSellerId: seller.id }
      })
    }

    // 3. Handle KYC
    else if (section === "kyc") {
      const idType = (fd.get("idType") as string)?.trim()
      const idNumber = (fd.get("idNumber") as string)?.trim()
      const idFront = fd.get("idFront") as File | null
      const idBack = fd.get("idBack") as File | null
      const selfie = fd.get("selfie") as File | null

      const kycData: any = { idType, idNumber }

      if (idFront && idFront.size > 0) kycData.idFrontUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(idFront.name), contentType: idFront.type, buffer: Buffer.from(await idFront.arrayBuffer()), prefix: "restaurant-id-front" })
      if (idBack && idBack.size > 0) kycData.idBackUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(idBack.name), contentType: idBack.type, buffer: Buffer.from(await idBack.arrayBuffer()), prefix: "restaurant-id-back" })
      if (selfie && selfie.size > 0) kycData.selfieUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(selfie.name), contentType: selfie.type, buffer: Buffer.from(await selfie.arrayBuffer()), prefix: "restaurant-selfie" })

      await prisma.restaurantKYC.upsert({
        where: { restaurantSellerId: seller.id },
        update: kycData,
        create: { ...kycData, restaurantSellerId: seller.id }
      })
    }

    // 4. Handle Bank
    else if (section === "bank") {
      const bankName = (fd.get("bankName") as string)?.trim()
      const bankAddress = (fd.get("bankAddress") as string)?.trim()
      const accountHolderName = (fd.get("accountHolderName") as string)?.trim()
      const accountNumber = (fd.get("accountNumber") as string)?.trim()
      const bbanNumber = (fd.get("bbanNumber") as string)?.trim()
      const branchName = (fd.get("branchName") as string)?.trim()
      const mobileMoneyOption = (fd.get("mobileMoneyOption") as string)?.trim()
      const preferredPayoutMethod = (fd.get("preferredPayoutMethod") as string)?.trim()
      const passbook = fd.get("passbook") as File | null
      const bankLetter = fd.get("bankLetter") as File | null

      const bankData: any = { bankName, bankAddress, accountHolderName, accountNumber, bbanNumber, branchName, mobileMoneyOption, preferredPayoutMethod }

      if (passbook && passbook.size > 0) {
        bankData.passbookUrl = await uploadPublicFile({
          folder: "restaurant-onboarding/bank",
          ext: path.extname(passbook.name),
          contentType: passbook.type,
          buffer: Buffer.from(await passbook.arrayBuffer()),
          prefix: "restaurant-bank-passbook",
        })
      }
      if (bankLetter && bankLetter.size > 0) {
        bankData.bankLetterUrl = await uploadPublicFile({
          folder: "restaurant-onboarding/bank",
          ext: path.extname(bankLetter.name) || ".pdf",
          contentType: bankLetter.type || "application/pdf",
          buffer: Buffer.from(await bankLetter.arrayBuffer()),
          prefix: "restaurant-bank-letter",
        })
      }

      await prisma.restaurantBankDetails.upsert({
        where: { restaurantSellerId: seller.id },
        update: bankData,
        create: { ...bankData, restaurantSellerId: seller.id }
      })
    }

    // 5. Handle Restaurant Visuals & Scale Metrics
    else if (section === "restaurant") {
      const estimateRestaurantCount = parseInt(fd.get("estimateRestaurantCount") as string)
      const cuisines = fd.getAll("cuisines")
      const services = fd.getAll("services")
      const logo = fd.get("logo") as File | null
      const banner = fd.get("banner") as File | null
      const mainPhoto = fd.get("mainPhoto") as File | null

      const resData: any = {}
      if (!isNaN(estimateRestaurantCount)) resData.estimateRestaurantCount = estimateRestaurantCount
      if (cuisines.length > 0) resData.primaryCuisine = JSON.stringify(cuisines)
      if (services.length > 0) resData.serviceTypes = JSON.stringify(services)

      if (logo && logo.size > 0) resData.logo = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(logo.name), contentType: logo.type, buffer: Buffer.from(await logo.arrayBuffer()), prefix: "restaurant-logo" })
      if (banner && banner.size > 0) resData.banner = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(banner.name), contentType: banner.type, buffer: Buffer.from(await banner.arrayBuffer()), prefix: "restaurant-banner" })
      if (mainPhoto && mainPhoto.size > 0) resData.mainPhoto = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(mainPhoto.name), contentType: mainPhoto.type, buffer: Buffer.from(await mainPhoto.arrayBuffer()), prefix: "restaurant-main-photo" })

      if (Object.keys(resData).length > 0) {
        await prisma.restaurantSeller.update({
          where: { id: seller.id },
          data: resData
        })
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid section specified" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in mobile settings PUT API:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

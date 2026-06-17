import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole, Prisma } from "@prisma/client"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import bcrypt from "bcryptjs"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/product-seller/settings
 * Retrieve current settings for the authenticated product seller.
 */
export async function GET(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  try {
    const seller = await prisma.seller.findUnique({
      where: { userId },
      include: {
        store: true,
        businessInfo: true,
        kyc: true,
        bankDetails: true,
        selectedCategories: {
          select: { id: true, name: true, isActive: true }
        },
        user: {
          select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
        },
      },
    })

    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    return NextResponse.json({ success: true, data: seller })
  } catch (error) {
    console.error("Mobile get settings error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch settings" }, { status: 500 })
  }
}

/**
 * PUT /mobileapi/product-seller/settings
 * Update settings for the authenticated product seller.
 * Full parity with web settings logic.
 */
export async function PUT(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const seller = await prisma.seller.findUnique({
    where: { userId },
    include: { store: true, businessInfo: true, kyc: true, bankDetails: true }
  })

  if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

  const contentType = request.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData()

      const userData: Prisma.UserUpdateInput = {}
      const sellerUpdateData: Prisma.SellerUpdateInput = {}
      const storeUpdates: Prisma.StoreUpdateInput = {}

      // 1. User Profile Update
      const nameRaw = fd.get("name") as string | null
      const name = nameRaw !== null ? sanitizeInput(nameRaw) : null
      const phone = fd.get("phone") as string | null
      const phoneCountryCode = fd.get("phoneCountryCode") as string | null
      const password = fd.get("password") as string | null
      const currentPassword = fd.get("currentPassword") as string | null
      const profileImage = fd.get("profileImage") as File | null
 
      if (name !== null) userData.name = name
      if (phone !== null) userData.phone = phone.trim() || null
      if (phoneCountryCode !== null) userData.phoneCountryCode = phoneCountryCode.trim() || null

      if (password) {
        const passwordValidation = validatePassword(password.trim())
        if (!passwordValidation.isValid) {
          return NextResponse.json({ success: false, error: passwordValidation.error }, { status: 400 })
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { password: true }
        })
        if (dbUser?.password) {
          const curPass = (currentPassword || "").trim()
          if (!curPass) {
            return NextResponse.json({ success: false, error: "Current password is required to change password" }, { status: 400 })
          }
          const isPasswordCorrect = await bcrypt.compare(curPass, dbUser.password)
          if (!isPasswordCorrect) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 400 })
          }
        }
        userData.password = await bcrypt.hash(password.trim(), 10)
      }

      if (profileImage && profileImage.size > 0) {
        const type = profileImage.type?.toLowerCase() ?? ""
        if (type.startsWith("image/")) {
          userData.image = await uploadPublicFile({
            folder: "profile",
            ext: path.extname(profileImage.name) || ".jpg",
            contentType: profileImage.type || "image/jpeg",
            buffer: Buffer.from(await profileImage.arrayBuffer()),
            prefix: "profile",
          })
        }
      }

      // 2. Seller Data
      const nationIdNumber = fd.get("nationIdentityNumber") as string | null
      if (nationIdNumber !== null) sellerUpdateData.nationIdentityNumber = nationIdNumber.trim() || null

      // 3. Store Visuals & Coordinates (Multipart specific fields to match Web)
      const storeLat = fd.get("storeLat") as string | null
      const storeLng = fd.get("storeLng") as string | null
      const storeAddress = fd.get("storeAddress") as string | null
      const storeLogo = fd.get("storeLogo") as File | null
      const storeBanner = fd.get("storeBanner") as File | null

      if (storeAddress) storeUpdates.address = storeAddress
      if (storeLat && storeLng) {
        const lat = parseFloat(storeLat)
        const lng = parseFloat(storeLng)
        if (!isNaN(lat) && !isNaN(lng)) {
          storeUpdates.lat = lat
          storeUpdates.lng = lng
        }
      }

      if (storeLogo && storeLogo.size > 0) {
        storeUpdates.logo = await uploadPublicFile({
          folder: "onboarding/store",
          ext: path.extname(storeLogo.name) || ".jpg",
          contentType: storeLogo.type || "image/jpeg",
          buffer: Buffer.from(await storeLogo.arrayBuffer()),
          prefix: "store-logo",
        })
      }
      if (storeBanner && storeBanner.size > 0) {
        storeUpdates.banner = await uploadPublicFile({
          folder: "onboarding/store",
          ext: path.extname(storeBanner.name) || ".jpg",
          contentType: storeBanner.type || "image/jpeg",
          buffer: Buffer.from(await storeBanner.arrayBuffer()),
          prefix: "store-banner",
        })
      }

      // 4. Documentation & Business Uploads
      const businessName = fd.get("businessName") as string | null
      const businessType = fd.get("businessType") as string | null
      const businessRegNumber = fd.get("businessRegNumber") as string | null
      const haveGst = fd.get("haveGst") as string | null
      const taxIdNumber = fd.get("taxIdNumber") as string | null
      const gstCustomerName = fd.get("gstCustomerName") as string | null
      const gstInvNo = fd.get("gstInvNo") as string | null
      const street = fd.get("street") as string | null
      const city = fd.get("city") as string | null
      const district = fd.get("district") as string | null
      const state = fd.get("state") as string | null
      const postalCode = fd.get("postalCode") as string | null
      const natureOfBusiness = fd.get("natureOfBusiness") as string | null

      const busInfoData: any = {}
      if (businessName !== null) busInfoData.businessName = businessName.trim()
      if (businessType !== null) busInfoData.businessType = businessType.trim()
      if (businessRegNumber !== null) busInfoData.businessRegNumber = businessRegNumber.trim()
      if (haveGst !== null) {
        const h = haveGst === "true"
        busInfoData.haveGst = h
        if (!h) {
          // TIN is always required, do NOT clear it when GST is off
          busInfoData.gstInvNo = null
          busInfoData.gstCustomerName = null
        }
      }
      // TIN is always required regardless of GST status
      if (taxIdNumber !== null) {
        busInfoData.taxIdNumber = taxIdNumber.trim()
      }
      if (gstCustomerName !== null && (busInfoData.haveGst ?? seller.businessInfo?.haveGst)) {
        busInfoData.gstCustomerName = gstCustomerName.trim()
      }
      if (gstInvNo !== null && (busInfoData.haveGst ?? seller.businessInfo?.haveGst)) {
        busInfoData.gstInvNo = gstInvNo.trim()
      }
      if (street !== null) busInfoData.street = street.trim()
      if (city !== null) busInfoData.city = city.trim()
      if (district !== null) busInfoData.district = district.trim()
      if (state !== null) busInfoData.state = state.trim()
      if (postalCode !== null) busInfoData.postalCode = postalCode.trim()
      if (natureOfBusiness !== null) busInfoData.natureOfBusiness = natureOfBusiness.trim()

      const busRegCert = fd.get("busRegCert") as File | null
      if (busRegCert && busRegCert.size > 0) {
        busInfoData.busRegCertUrl = await uploadPublicFile({
          folder: "onboarding/business",
          ext: path.extname(busRegCert.name) || ".pdf",
          contentType: busRegCert.type || "application/pdf",
          buffer: Buffer.from(await busRegCert.arrayBuffer()),
          prefix: "bus-reg",
        })
      }

      const cityCouncilCert = fd.get("cityCouncilCert") as File | null
      if (cityCouncilCert && cityCouncilCert.size > 0) {
        busInfoData.cityCouncilCertUrl = await uploadPublicFile({
          folder: "onboarding/business",
          ext: path.extname(cityCouncilCert.name) || ".pdf",
          contentType: cityCouncilCert.type || "application/pdf",
          buffer: Buffer.from(await cityCouncilCert.arrayBuffer()),
          prefix: "city-council",
        })
      }

      const gstTinCert = fd.get("gstTinCert") as File | null
      if (gstTinCert && gstTinCert.size > 0) {
        busInfoData.gstTinCertUrl = await uploadPublicFile({
          folder: "onboarding/business",
          ext: path.extname(gstTinCert.name) || ".pdf",
          contentType: gstTinCert.type || "application/pdf",
          buffer: Buffer.from(await gstTinCert.arrayBuffer()),
          prefix: "gst-tin",
        })
      }

      const addressProof = fd.get("addressProof") as File | null
      if (addressProof && addressProof.size > 0) {
        busInfoData.addressProofUrl = await uploadPublicFile({
          folder: "onboarding/business",
          ext: path.extname(addressProof.name) || ".pdf",
          contentType: addressProof.type || "application/pdf",
          buffer: Buffer.from(await addressProof.arrayBuffer()),
          prefix: "address-proof",
        })
      }

      if (Object.keys(busInfoData).length > 0) {
        sellerUpdateData.businessInfo = {
          upsert: {
            update: busInfoData,
            create: { ...busInfoData }
          }
        }
      }

      const bankName = fd.get("bankName") as string | null
      const bankAddress = fd.get("bankAddress") as string | null
      const accountHolderName = fd.get("accountHolderName") as string | null
      const accountNumber = fd.get("accountNumber") as string | null
      const bbanNumber = fd.get("bbanNumber") as string | null
      const branchName = fd.get("branchName") as string | null
      const mobileMoneyOption = fd.get("mobileMoneyOption") as string | null
      const preferredPayoutMethod = fd.get("preferredPayoutMethod") as string | null

      const bankData: any = {}
      if (bankName !== null) bankData.bankName = bankName.trim()
      if (bankAddress !== null) bankData.bankAddress = bankAddress.trim()
      if (accountHolderName !== null) bankData.accountHolderName = accountHolderName.trim()
      if (accountNumber !== null) bankData.accountNumber = accountNumber.trim()
      if (bbanNumber !== null) bankData.bbanNumber = bbanNumber.trim()
      if (branchName !== null) bankData.branchName = branchName.trim()
      if (mobileMoneyOption !== null) bankData.mobileMoneyOption = mobileMoneyOption.trim()
      if (preferredPayoutMethod !== null) bankData.preferredPayoutMethod = preferredPayoutMethod.trim()

      const bankPassbook = fd.get("bankPassbook") as File | null
      if (bankPassbook && bankPassbook.size > 0) {
        const url = await uploadPublicFile({
          folder: "onboarding/bank",
          ext: path.extname(bankPassbook.name) || ".jpg",
          contentType: bankPassbook.type || "image/jpeg",
          buffer: Buffer.from(await bankPassbook.arrayBuffer()),
          prefix: "bank-passbook",
        })
        bankData.passbookUrl = url
      }

      const bankLetter = fd.get("bankLetter") as File | null
      if (bankLetter && bankLetter.size > 0) {
        const url = await uploadPublicFile({
          folder: "onboarding/bank",
          ext: path.extname(bankLetter.name) || ".pdf",
          contentType: bankLetter.type || "application/pdf",
          buffer: Buffer.from(await bankLetter.arrayBuffer()),
          prefix: "bank-letter",
        })
        bankData.bankLetterUrl = url
      }

      if (Object.keys(bankData).length > 0) {
        sellerUpdateData.bankDetails = {
          upsert: {
            update: bankData,
            create: { ...bankData }
          }
        }
      }

      // 5. KYC Uploads
      const kycData: Prisma.SellerKYCUpdateWithoutSellerInput = {}
      const idFront = fd.get("idFront") as File | null
      const idBack = fd.get("idBack") as File | null
      const selfie = fd.get("selfie") as File | null

      if (idFront && idFront.size > 0) {
        kycData.idFrontUrl = await uploadPublicFile({
          folder: "onboarding/kyc",
          ext: path.extname(idFront.name) || ".jpg",
          contentType: idFront.type || "image/jpeg",
          buffer: Buffer.from(await idFront.arrayBuffer()),
          prefix: "id-front",
        })
      }
      if (idBack && idBack.size > 0) {
        kycData.idBackUrl = await uploadPublicFile({
          folder: "onboarding/kyc",
          ext: path.extname(idBack.name) || ".jpg",
          contentType: idBack.type || "image/jpeg",
          buffer: Buffer.from(await idBack.arrayBuffer()),
          prefix: "id-back",
        })
      }
      if (selfie && selfie.size > 0) {
        kycData.selfieUrl = await uploadPublicFile({
          folder: "onboarding/kyc",
          ext: path.extname(selfie.name) || ".jpg",
          contentType: selfie.type || "image/jpeg",
          buffer: Buffer.from(await selfie.arrayBuffer()),
          prefix: "selfie",
        })
      }

      if (Object.keys(kycData).length > 0) {
        sellerUpdateData.kyc = {
          upsert: {
            update: kycData,
            create: kycData as any
          }
        }
      }

      // Execute Multipart Updates
      if (userData.phone) {
        const existing = await prisma.user.findFirst({ where: { phone: userData.phone as string, NOT: { id: userId } } })
        if (existing) return NextResponse.json({ success: false, error: "Phone number already in use" }, { status: 400 })
      }

      if (Object.keys(userData).length > 0) {
        await prisma.user.update({ where: { id: userId }, data: userData })
      }

      if (Object.keys(storeUpdates).length > 0) {
        sellerUpdateData.store = {
          upsert: {
            update: storeUpdates,
            create: { ...storeUpdates as any, name: "My Store" }
          }
        }
      }

      if (Object.keys(sellerUpdateData).length > 0) {
        await prisma.seller.update({ where: { id: seller.id }, data: sellerUpdateData })
      }

      const categoryIds = fd.getAll("categoryIds") as string[]
      if (categoryIds.length > 0) {
        await prisma.seller.update({
          where: { id: seller.id },
          data: {
            selectedCategories: {
              set: categoryIds.map(id => ({ id }))
            }
          }
        })
      }

      return NextResponse.json({ success: true, message: "Settings updated successfully" })
    }

    // JSON Payload Update
    const body = await request.json()
    const { user, store, seller: sData } = body

    if (user) {
      const userData: Prisma.UserUpdateInput = {}
      if (user.name !== undefined) {
        userData.name = typeof user.name === "string" ? sanitizeInput(user.name) : undefined
      }
      if (user.image !== undefined) userData.image = user.image
      if (user.phone !== undefined) {
        userData.phone = user.phone || null
        if (userData.phone) {
          const existing = await prisma.user.findFirst({ where: { phone: userData.phone as string, NOT: { id: userId } } })
          if (existing) return NextResponse.json({ success: false, error: "Phone number already in use" }, { status: 400 })
        }
      }
      if (user.phoneCountryCode !== undefined) userData.phoneCountryCode = user.phoneCountryCode || null
      if (user.password !== undefined && user.password !== null) {
        const passwordValidation = validatePassword(user.password.trim())
        if (!passwordValidation.isValid) {
          return NextResponse.json({ success: false, error: passwordValidation.error }, { status: 400 })
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { password: true }
        })
        if (dbUser?.password) {
          const curPass = (user.currentPassword || "").trim()
          if (!curPass) {
            return NextResponse.json({ success: false, error: "Current password is required to change password" }, { status: 400 })
          }
          const isPasswordCorrect = await bcrypt.compare(curPass, dbUser.password)
          if (!isPasswordCorrect) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 400 })
          }
        }
        userData.password = await bcrypt.hash(user.password.trim(), 10)
      }
      if (Object.keys(userData).length > 0) {
        await prisma.user.update({ where: { id: userId }, data: userData })
      }
    }

    const finalSellerUpdate: Prisma.SellerUpdateInput = {}

    if (store && Object.keys(store).length > 0) {
      const allowed = ["name", "description", "phone", "website", "address", "city", "state", "zipCode", "country", "logo", "banner", "lat", "lng"]
      const data = Object.fromEntries(Object.entries(store).filter(([k]) => allowed.includes(k)))
      if (Object.keys(data).length > 0) {
        finalSellerUpdate.store = {
          upsert: {
            update: data,
            create: { ...data as any, name: (data.name as string) || "My Store" }
          }
        }
      }
    }

    if (sData) {
      // Handle Business Info including GST logic from Web
      if (sData.businessInfo) {
        const bInfo = { ...sData.businessInfo }
        if (bInfo.haveGst !== undefined) {
          const h = bInfo.haveGst === "true" || bInfo.haveGst === true
          bInfo.haveGst = h
          if (!h) {
            // TIN is always required, do NOT clear it when GST is off
            bInfo.gstInvNo = null
            bInfo.gstCustomerName = null
          }
        }
        finalSellerUpdate.businessInfo = {
          upsert: {
            update: bInfo,
            create: { ...bInfo }
          }
        }
      }

      if (sData.bankDetails) {
        finalSellerUpdate.bankDetails = {
          upsert: {
            update: sData.bankDetails,
            create: { ...sData.bankDetails }
          }
        }
      }

      if (sData.kyc) {
        finalSellerUpdate.kyc = {
          upsert: {
            update: sData.kyc,
            create: { ...sData.kyc }
          }
        }
      }

      if (sData.nationIdentityNumber !== undefined) {
        finalSellerUpdate.nationIdentityNumber = typeof sData.nationIdentityNumber === "string" ? sData.nationIdentityNumber.trim() || null : null
      }

      if (sData.categoryIds && Array.isArray(sData.categoryIds)) {
        finalSellerUpdate.selectedCategories = { set: sData.categoryIds.map((id: string) => ({ id })) }
      }
    }

    if (Object.keys(finalSellerUpdate).length > 0) {
      await prisma.seller.update({ where: { id: seller.id }, data: finalSellerUpdate })
    }

    return NextResponse.json({ success: true, message: "Settings updated successfully" })

  } catch (error: any) {
    console.error("Mobile settings update error:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to update settings" }, { status: 500 })
  }
}

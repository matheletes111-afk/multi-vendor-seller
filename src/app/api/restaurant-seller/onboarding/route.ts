import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { UserRole } from "@prisma/client"

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_RESTAURANT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: session.user.id },
    include: { businessInfo: true, kyc: true, bankDetails: true, agreement: true, user: { select: { image: true, name: true, email: true } } }
  })

  return NextResponse.json(seller)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_RESTAURANT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: session.user.id },
    include: { businessInfo: true, kyc: true, bankDetails: true, agreement: true }
  })

  if (!seller) return NextResponse.json({ error: "Restaurant seller not found" }, { status: 404 })

  const contentType = request.headers.get("content-type") ?? ""
  let step: number = 0
  let formData: FormData | null = null
  let jsonBody: any = null

  if (contentType.includes("multipart/form-data")) {
    formData = await request.formData()
    step = parseInt(formData.get("step") as string, 10)
  } else {
    jsonBody = await request.json()
    step = jsonBody.step
  }

  try {
    if (step === 2) {
      // Step 2: Business Information
      const haveGst = formData ? (formData.get("haveGst") === "true") : !!jsonBody.data.haveGst
      const businessData = {
        businessName: (formData?.get("businessName") as string) || jsonBody?.data?.businessName,
        businessType: (formData?.get("businessType") as string) || jsonBody?.data?.businessType,
        businessRegNumber: (formData?.get("businessRegNumber") as string) || jsonBody?.data?.businessRegNumber,
        taxIdNumber: (formData?.get("taxIdNumber") as string) || jsonBody?.data?.taxIdNumber,
        landmark: (formData?.get("landmark") as string) || jsonBody?.data?.landmark,
        managerName: (formData?.get("managerName") as string) || jsonBody?.data?.managerName,
        pocContact: (formData?.get("pocContact") as string) || jsonBody?.data?.pocContact,
        street: (formData?.get("street") as string) || jsonBody?.data?.street,
        city: (formData?.get("city") as string) || jsonBody?.data?.city,
        district: (formData?.get("district") as string) || jsonBody?.data?.district,
        state: (formData?.get("state") as string) || jsonBody?.data?.state,
        haveGst,
        gstInvNo: haveGst ? ((formData?.get("gstInvNo") as string) || jsonBody?.data?.gstInvNo) : null,
        gstCustomerName: haveGst ? ((formData?.get("gstCustomerName") as string) || jsonBody?.data?.gstCustomerName) : null,
      }

      if (formData) {
        const profileImageFile = formData.get("profileImage") as File | null
        if (profileImageFile && profileImageFile.size > 0) {
          const imageUrl = await uploadPublicFile({ folder: "profile", ext: path.extname(profileImageFile.name) || ".jpg", contentType: profileImageFile.type || "image/jpeg", buffer: Buffer.from(await profileImageFile.arrayBuffer()), prefix: "profile" })
          await prisma.user.update({ where: { id: session.user.id }, data: { image: imageUrl } })
        }
      }

      let busRegCertUrl = seller.businessInfo?.busRegCertUrl
      if (formData) {
        const file = formData.get("busRegCert") as File | null
        if (file && file.size > 0) {
          busRegCertUrl = await uploadPublicFile({ folder: "restaurant-onboarding/business", ext: path.extname(file.name) || ".pdf", contentType: file.type || "application/pdf", buffer: Buffer.from(await file.arrayBuffer()), prefix: "restaurant-bus-reg" })
        }
      }

      await prisma.restaurantBusinessInfo.upsert({ where: { restaurantSellerId: seller.id }, update: { ...businessData, busRegCertUrl }, create: { ...businessData, busRegCertUrl, restaurantSellerId: seller.id } })

    } else if (step === 3) {
      // Step 3: KYC & Food License
      const kycData = {
        idType: (formData?.get("idType") as string) || jsonBody?.data?.idType,
        idNumber: (formData?.get("idNumber") as string) || jsonBody?.data?.idNumber,
        foodLicenseNumber: (formData?.get("foodLicenseNumber") as string) || jsonBody?.data?.foodLicenseNumber,
      }

      let idFrontUrl = seller.kyc?.idFrontUrl
      let idBackUrl = seller.kyc?.idBackUrl
      let selfieUrl = seller.kyc?.selfieUrl
      let foodLicenseUrl = seller.kyc?.foodLicenseUrl

      if (formData) {
        const front = formData.get("idFront") as File | null
        const back = formData.get("idBack") as File | null
        const selfie = formData.get("selfie") as File | null
        const license = formData.get("foodLicense") as File | null

        if (front && front.size > 0) idFrontUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(front.name) || ".jpg", contentType: front.type || "image/jpeg", buffer: Buffer.from(await front.arrayBuffer()), prefix: "restaurant-id-front" })
        if (back && back.size > 0) idBackUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(back.name) || ".jpg", contentType: back.type || "image/jpeg", buffer: Buffer.from(await back.arrayBuffer()), prefix: "restaurant-id-back" })
        if (selfie && selfie.size > 0) selfieUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(selfie.name) || ".jpg", contentType: selfie.type || "image/jpeg", buffer: Buffer.from(await selfie.arrayBuffer()), prefix: "restaurant-selfie" })
        if (license && license.size > 0) foodLicenseUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(license.name) || ".pdf", contentType: license.type || "application/pdf", buffer: Buffer.from(await license.arrayBuffer()), prefix: "restaurant-food-license" })
      }

      await prisma.restaurantKYC.upsert({ where: { restaurantSellerId: seller.id }, update: { ...kycData, idFrontUrl, idBackUrl, selfieUrl, foodLicenseUrl }, create: { ...kycData, idFrontUrl, idBackUrl, selfieUrl, foodLicenseUrl, restaurantSellerId: seller.id } })

    } else if (step === 4) {
      // Step 4: Outlet Setup
      const estimateRestaurantCount = parseInt((formData?.get("estimateRestaurantCount") as string) || jsonBody?.data?.estimateRestaurantCount) || 0
      const cuisines = formData ? formData.getAll("cuisines") : (jsonBody?.data?.cuisines || [])
      const services = formData ? formData.getAll("services") : (jsonBody?.data?.services || [])
      
      let logoUrl = seller.logo
      let bannerUrl = seller.banner
      let mainPhotoUrl = seller.mainPhoto

      if (formData) {
        const logo = formData.get("logo") as File | null
        const banner = formData.get("banner") as File | null
        const photo = formData.get("mainPhoto") as File | null

        if (logo && logo.size > 0) logoUrl = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(logo.name) || ".jpg", contentType: logo.type || "image/jpeg", buffer: Buffer.from(await logo.arrayBuffer()), prefix: "restaurant-logo" })
        if (banner && banner.size > 0) bannerUrl = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(banner.name) || ".jpg", contentType: banner.type || "image/jpeg", buffer: Buffer.from(await banner.arrayBuffer()), prefix: "restaurant-banner" })
        if (photo && photo.size > 0) mainPhotoUrl = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(photo.name) || ".jpg", contentType: photo.type || "image/jpeg", buffer: Buffer.from(await photo.arrayBuffer()), prefix: "restaurant-main-photo" })
      }

      await prisma.restaurantSeller.update({
        where: { id: seller.id },
        data: {
          estimateRestaurantCount,
          primaryCuisine: JSON.stringify(cuisines),
          serviceTypes: JSON.stringify(services),
          logo: logoUrl,
          banner: bannerUrl,
          mainPhoto: mainPhotoUrl,
        },
      })

    } else if (step === 5) {
      // Step 5: Bank Details
      const bankData = {
        bankName: (formData?.get("bankName") as string) || jsonBody?.data?.bankName,
        accountHolderName: (formData?.get("accountHolderName") as string) || jsonBody?.data?.accountHolderName,
        accountNumber: (formData?.get("accountNumber") as string) || jsonBody?.data?.accountNumber,
        branchName: (formData?.get("branchName") as string) || jsonBody?.data?.branchName,
        mobileMoneyOption: (formData?.get("mobileMoneyOption") as string) || jsonBody?.data?.mobileMoneyOption,
        preferredPayoutMethod: (formData?.get("preferredPayoutMethod") as string) || jsonBody?.data?.preferredPayoutMethod,
      }

      let passbookUrl = seller.bankDetails?.passbookUrl
      if (formData) {
        const file = formData.get("passbook") as File | null
        if (file && file.size > 0) passbookUrl = await uploadPublicFile({ folder: "restaurant-onboarding/bank", ext: path.extname(file.name) || ".jpg", contentType: file.type || "image/jpeg", buffer: Buffer.from(await file.arrayBuffer()), prefix: "restaurant-bank-passbook" })
      }

      await prisma.restaurantBankDetails.upsert({ where: { restaurantSellerId: seller.id }, update: { ...bankData, passbookUrl }, create: { ...bankData, passbookUrl, restaurantSellerId: seller.id } })

    } else if (step === 6) {
      // Step 6: Agreement
      const agreementData = jsonBody?.data || {
        agreedToTerms: formData?.get("agreedToTerms") === "on",
        agreedToCommission: formData?.get("agreedToCommission") === "on",
        agreedToPrivacy: formData?.get("agreedToPrivacy") === "on",
      }

      await prisma.restaurantAgreement.upsert({ where: { restaurantSellerId: seller.id }, update: agreementData, create: { ...agreementData, restaurantSellerId: seller.id } })

      await prisma.restaurantSeller.update({ where: { id: seller.id }, data: { onboardingCompleted: true, onboardingStep: 7 } })

      return NextResponse.json({ success: true, completed: true })
    }

    await prisma.restaurantSeller.update({ where: { id: seller.id }, data: { onboardingStep: Math.max(seller.onboardingStep, step + 1) } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Restaurant onboarding API error:", error)
    return NextResponse.json({ error: error.message || "Failed to process onboarding step" }, { status: 500 })
  }
}

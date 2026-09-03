import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { UserRole } from "@prisma/client"
import { activateRestaurantFreePlan } from "@/lib/subscriptions"
import { sendSellerWelcomeEmail, sendAdminNewSellerAlertEmail } from "@/lib/email"
import { formatHearAboutUs } from "@/lib/onboarding-constants"
import { evaluateSellerDocuments } from "@/lib/seller-approval-validation"
import { validateOnboardingFile } from "@/lib/onboarding-file-validation"



export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_RESTAURANT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: session.user.id },
    include: { businessInfo: true, kyc: true, bankDetails: true, agreement: true, user: { select: { image: true, name: true, email: true } } }
  })

  if (seller) {
    const { getPresignedUrlOrOriginal } = await import("@/lib/s3-presigned")
    if (seller.user?.image) {
      seller.user.image = await getPresignedUrlOrOriginal(seller.user.image)
    }
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
  }

  return NextResponse.json(seller)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_RESTAURANT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: session.user.id },
    include: { businessInfo: true, kyc: true, bankDetails: true, agreement: true, user: true }
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

      let userImage = seller.user?.image
      if (formData) {
        const profileImageFile = formData.get("profileImage") as File | null
        if (profileImageFile && profileImageFile.size > 0) {
          const val = validateOnboardingFile(profileImageFile, { imagesOnly: true, maxSizeMb: 4.5 })
          if (!val.isValid) {
            return NextResponse.json({ error: `Profile Picture: ${val.error}` }, { status: 400 })
          }
          userImage = await uploadPublicFile({ folder: "profile", ext: path.extname(profileImageFile.name) || ".jpg", contentType: profileImageFile.type || "image/jpeg", buffer: Buffer.from(await profileImageFile.arrayBuffer()), prefix: "profile" })
          await prisma.user.update({ where: { id: session.user.id }, data: { image: userImage } })
        }
      } else if (jsonBody?.data?.image) {
        userImage = jsonBody.data.image
        await prisma.user.update({ where: { id: session.user.id }, data: { image: userImage } })
      }

      if (!userImage) {
        return NextResponse.json({ error: "Profile Picture is mandatory." }, { status: 400 })
      }

      let busRegCertUrl = seller.businessInfo?.busRegCertUrl
      let cityCouncilCertUrl = seller.businessInfo?.cityCouncilCertUrl
      let gstTinCertUrl = seller.businessInfo?.gstTinCertUrl
      let addressProofUrl = seller.businessInfo?.addressProofUrl

      if (formData) {
        const docFiles = [
          { key: "busRegCert", label: "Business Registration" },
          { key: "cityCouncilCert", label: "City Council Certificate" },
          { key: "gstTinCert", label: "GST TIN Certificate" },
          { key: "addressProof", label: "Address Proof" },
        ]
        for (const item of docFiles) {
          const f = formData.get(item.key) as File | null
          if (f && f.size > 0) {
            const val = validateOnboardingFile(f, { maxSizeMb: 4.5 })
            if (!val.isValid) {
              return NextResponse.json({ error: `${item.label}: ${val.error}` }, { status: 400 })
            }
          }
        }
        const file = formData.get("busRegCert") as File | null
        if (file && file.size > 0) {
          busRegCertUrl = await uploadPublicFile({ folder: "restaurant-onboarding/business", ext: path.extname(file.name) || ".pdf", contentType: file.type || "application/pdf", buffer: Buffer.from(await file.arrayBuffer()), prefix: "restaurant-bus-reg" })
        }
        const fileCC = formData.get("cityCouncilCert") as File | null
        if (fileCC && fileCC.size > 0) {
          cityCouncilCertUrl = await uploadPublicFile({ folder: "restaurant-onboarding/business", ext: path.extname(fileCC.name) || ".pdf", contentType: fileCC.type || "application/pdf", buffer: Buffer.from(await fileCC.arrayBuffer()), prefix: "restaurant-city-council" })
        }
        const fileGST = formData.get("gstTinCert") as File | null
        if (fileGST && fileGST.size > 0) {
          gstTinCertUrl = await uploadPublicFile({ folder: "restaurant-onboarding/business", ext: path.extname(fileGST.name) || ".pdf", contentType: fileGST.type || "application/pdf", buffer: Buffer.from(await fileGST.arrayBuffer()), prefix: "restaurant-gst-tin" })
        }
        const fileAP = formData.get("addressProof") as File | null
        if (fileAP && fileAP.size > 0) {
          addressProofUrl = await uploadPublicFile({ folder: "restaurant-onboarding/business", ext: path.extname(fileAP.name) || ".pdf", contentType: fileAP.type || "application/pdf", buffer: Buffer.from(await fileAP.arrayBuffer()), prefix: "restaurant-address-proof" })
        }
      } else if (jsonBody?.data) {
        if (jsonBody.data.busRegCertUrl) busRegCertUrl = jsonBody.data.busRegCertUrl
        if (jsonBody.data.cityCouncilCertUrl) cityCouncilCertUrl = jsonBody.data.cityCouncilCertUrl
        if (jsonBody.data.gstTinCertUrl) gstTinCertUrl = jsonBody.data.gstTinCertUrl
        if (jsonBody.data.addressProofUrl) addressProofUrl = jsonBody.data.addressProofUrl
      }

      if (!busRegCertUrl) {
        return NextResponse.json({ error: "Business Registration Certificate is mandatory." }, { status: 400 })
      }
      if (haveGst && !gstTinCertUrl) {
        return NextResponse.json({ error: "GST TIN Certificate is mandatory when selling with GST." }, { status: 400 })
      }

      await prisma.restaurantBusinessInfo.upsert({ where: { restaurantSellerId: seller.id }, update: { ...businessData, busRegCertUrl, cityCouncilCertUrl, gstTinCertUrl, addressProofUrl }, create: { ...businessData, busRegCertUrl, cityCouncilCertUrl, gstTinCertUrl, addressProofUrl, restaurantSellerId: seller.id } })

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

        for (const [f, label] of [[front, "ID Front"], [back, "ID Back"], [selfie, "Selfie Check"]] as const) {
          if (f && f.size > 0) {
            const val = validateOnboardingFile(f, { imagesOnly: true, maxSizeMb: 4.5 })
            if (!val.isValid) {
              return NextResponse.json({ error: `${label}: ${val.error}` }, { status: 400 })
            }
          }
        }
        if (license && license.size > 0) {
          const val = validateOnboardingFile(license, { maxSizeMb: 4.5 })
          if (!val.isValid) {
            return NextResponse.json({ error: `Food License: ${val.error}` }, { status: 400 })
          }
        }

        if (front && front.size > 0) idFrontUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(front.name) || ".jpg", contentType: front.type || "image/jpeg", buffer: Buffer.from(await front.arrayBuffer()), prefix: "restaurant-id-front" })
        if (back && back.size > 0) idBackUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(back.name) || ".jpg", contentType: back.type || "image/jpeg", buffer: Buffer.from(await back.arrayBuffer()), prefix: "restaurant-id-back" })
        if (selfie && selfie.size > 0) selfieUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(selfie.name) || ".jpg", contentType: selfie.type || "image/jpeg", buffer: Buffer.from(await selfie.arrayBuffer()), prefix: "restaurant-selfie" })
        if (license && license.size > 0) foodLicenseUrl = await uploadPublicFile({ folder: "restaurant-onboarding/kyc", ext: path.extname(license.name) || ".pdf", contentType: license.type || "application/pdf", buffer: Buffer.from(await license.arrayBuffer()), prefix: "restaurant-food-license" })
      }

      if (!idFrontUrl) {
        return NextResponse.json({ error: "National ID / Passport Front document is mandatory." }, { status: 400 })
      }
      if (!idBackUrl) {
        return NextResponse.json({ error: "National ID / Passport Back document is mandatory." }, { status: 400 })
      }
      if (!foodLicenseUrl) {
        return NextResponse.json({ error: "Food Hygiene / Food License document is mandatory." }, { status: 400 })
      }
      if (!selfieUrl) {
        return NextResponse.json({ error: "Selfie / Face Verification is mandatory." }, { status: 400 })
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

        for (const [f, label] of [[logo, "Restaurant Logo"], [banner, "Restaurant Banner"], [photo, "Main Photo"]] as const) {
          if (f && f.size > 0) {
            const val = validateOnboardingFile(f, { imagesOnly: true, maxSizeMb: 4.5 })
            if (!val.isValid) {
              return NextResponse.json({ error: `${label}: ${val.error}` }, { status: 400 })
            }
          }
        }

        if (logo && logo.size > 0) logoUrl = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(logo.name) || ".jpg", contentType: logo.type || "image/jpeg", buffer: Buffer.from(await logo.arrayBuffer()), prefix: "restaurant-logo" })
        if (banner && banner.size > 0) bannerUrl = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(banner.name) || ".jpg", contentType: banner.type || "image/jpeg", buffer: Buffer.from(await banner.arrayBuffer()), prefix: "restaurant-banner" })
        if (photo && photo.size > 0) mainPhotoUrl = await uploadPublicFile({ folder: "restaurant-onboarding/property", ext: path.extname(photo.name) || ".jpg", contentType: photo.type || "image/jpeg", buffer: Buffer.from(await photo.arrayBuffer()), prefix: "restaurant-main-photo" })
      }

      if (!logoUrl || !mainPhotoUrl) {
        return NextResponse.json({ error: "Restaurant Logo and Main Restaurant Photo are mandatory." }, { status: 400 })
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
        bankAddress: (formData?.get("bankAddress") as string) || jsonBody?.data?.bankAddress,
        accountHolderName: (formData?.get("accountHolderName") as string) || jsonBody?.data?.accountHolderName,
        accountNumber: (formData?.get("accountNumber") as string) || jsonBody?.data?.accountNumber,
        bbanNumber: (formData?.get("bbanNumber") as string) || jsonBody?.data?.bbanNumber,
        branchName: (formData?.get("branchName") as string) || jsonBody?.data?.branchName,
        mobileMoneyOption: (formData?.get("mobileMoneyOption") as string) || jsonBody?.data?.mobileMoneyOption,
        preferredPayoutMethod: ((formData?.get("preferredPayoutMethod") as string)?.trim()) || jsonBody?.data?.preferredPayoutMethod || "Bank Transfer",
      }

      let passbookUrl = seller.bankDetails?.passbookUrl
      let bankLetterUrl = seller.bankDetails?.bankLetterUrl
      if (formData) {
        const file = formData.get("passbook") as File | null
        const fileBL = formData.get("bankLetter") as File | null

        for (const [f, label] of [[file, "Bank Passbook"], [fileBL, "Bank Letter"]] as const) {
          if (f && f.size > 0) {
            const val = validateOnboardingFile(f, { maxSizeMb: 4.5 })
            if (!val.isValid) {
              return NextResponse.json({ error: `${label}: ${val.error}` }, { status: 400 })
            }
          }
        }

        if (file && file.size > 0) {
          passbookUrl = await uploadPublicFile({ folder: "restaurant-onboarding/bank", ext: path.extname(file.name) || ".jpg", contentType: file.type || "image/jpeg", buffer: Buffer.from(await file.arrayBuffer()), prefix: "restaurant-bank-passbook" })
        }
        if (fileBL && fileBL.size > 0) {
          bankLetterUrl = await uploadPublicFile({ folder: "restaurant-onboarding/bank", ext: path.extname(fileBL.name) || ".pdf", contentType: fileBL.type || "application/pdf", buffer: Buffer.from(await fileBL.arrayBuffer()), prefix: "restaurant-bank-letter" })
        }
      } else if (jsonBody?.data) {
        if (jsonBody.data.passbookUrl) passbookUrl = jsonBody.data.passbookUrl
        if (jsonBody.data.bankLetterUrl) bankLetterUrl = jsonBody.data.bankLetterUrl
      }



      await prisma.restaurantBankDetails.upsert({ where: { restaurantSellerId: seller.id }, update: { ...bankData, passbookUrl, bankLetterUrl }, create: { ...bankData, passbookUrl, bankLetterUrl, restaurantSellerId: seller.id } })

    } else if (step === 6) {
      // Step 6: Agreement
      const rawHearAboutUs = (jsonBody?.data?.hearAboutUs || jsonBody?.hearAboutUs || (formData?.get("hearAboutUs") as string)) || null
      const rawHearAboutUsOther = (jsonBody?.data?.hearAboutUsOther || jsonBody?.hearAboutUsOther || (formData?.get("hearAboutUsOther") as string)) || null

      if (!rawHearAboutUs || !rawHearAboutUs.trim()) {
        return NextResponse.json({ error: "Please select how you heard about us." }, { status: 400 })
      }
      if (rawHearAboutUs.trim() === "Other" && (!rawHearAboutUsOther || !rawHearAboutUsOther.trim())) {
        return NextResponse.json({ error: "Please specify where you heard about our platform." }, { status: 400 })
      }

      const agreementData = {
        agreedToTerms: !!(jsonBody?.data?.agreedToTerms ?? (formData?.get("agreedToTerms") === "true" || formData?.get("agreedToTerms") === "on")),
        agreedToCommission: !!(jsonBody?.data?.agreedToCommission ?? (formData?.get("agreedToCommission") === "true" || formData?.get("agreedToCommission") === "on")),
        agreedToPrivacy: !!(jsonBody?.data?.agreedToPrivacy ?? (formData?.get("agreedToPrivacy") === "true" || formData?.get("agreedToPrivacy") === "on")),
        hearAboutUs: formatHearAboutUs(rawHearAboutUs, rawHearAboutUsOther),
      }

      await prisma.restaurantAgreement.upsert({ where: { restaurantSellerId: seller.id }, update: agreementData, create: { ...agreementData, restaurantSellerId: seller.id } })

      // Strict validation before marking complete
      const verifySeller = await prisma.restaurantSeller.findUnique({
        where: { id: seller.id },
        include: { businessInfo: true, kyc: true, bankDetails: true, agreement: true, user: true }
      })
      const docEval = evaluateSellerDocuments(verifySeller, "RESTAURANT")
      if (!docEval.isComplete) {
        return NextResponse.json({
          error: `Cannot complete onboarding: Missing required documents: ${docEval.missingDocuments.join(", ")}`
        }, { status: 400 })
      }

      await prisma.restaurantSeller.update({ where: { id: seller.id }, data: { onboardingCompleted: true, onboardingStep: 7, status: "PENDING", adminFeedback: null } })

      await activateRestaurantFreePlan(seller.id)

      try {
        const fullSeller = await prisma.restaurantSeller.findUnique({
          where: { id: seller.id },
          include: { user: { select: { email: true, name: true, role: true } } }
        })
        if (fullSeller && fullSeller.user?.email) {
          await sendSellerWelcomeEmail({
            to: fullSeller.user.email,
            name: fullSeller.user.name ?? "Seller",
          })
          const admins = await prisma.user.findMany({
            where: { role: "ADMIN" },
            select: { email: true }
          })
          for (const admin of admins) {
            await sendAdminNewSellerAlertEmail({
              to: admin.email,
              sellerName: fullSeller.user.name ?? "Seller",
              sellerEmail: fullSeller.user.email,
              sellerRole: fullSeller.user.role,
            })
          }
        }
      } catch (emailErr) {
        console.error("Failed to send seller onboarding completion emails:", emailErr)
      }

      return NextResponse.json({ success: true, completed: true })
    }

    await prisma.restaurantSeller.update({ where: { id: seller.id }, data: { onboardingStep: Math.max(seller.onboardingStep, step + 1) } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Restaurant onboarding API error:", error)
    return NextResponse.json({ error: error.message || "Failed to process onboarding step" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { UserRole } from "@prisma/client"
import { activateHotelFreePlan } from "@/lib/subscriptions"
import { sendSellerWelcomeEmail, sendAdminNewSellerAlertEmail } from "@/lib/email"



export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id },
    include: {
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      agreement: true,
      user: {
        select: { image: true, name: true, email: true }
      }
    }
  })

  if (seller) {
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
      const [front, back, selfie] = await Promise.all([
        getPresignedUrlOrOriginal(seller.kyc.idFrontUrl),
        getPresignedUrlOrOriginal(seller.kyc.idBackUrl),
        getPresignedUrlOrOriginal(seller.kyc.selfieUrl)
      ])
      seller.kyc.idFrontUrl = front
      seller.kyc.idBackUrl = back
      seller.kyc.selfieUrl = selfie
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
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id },
    include: { businessInfo: true, kyc: true, bankDetails: true, agreement: true }
  })

  if (!seller) {
    return NextResponse.json({ error: "Hotel seller not found" }, { status: 404 })
  }

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

      // Handle User Profile Image
      if (formData) {
        const profileImageFile = formData.get("profileImage") as File | null
        if (profileImageFile && profileImageFile.size > 0) {
          const imageUrl = await uploadPublicFile({
            folder: "profile",
            ext: path.extname(profileImageFile.name) || ".jpg",
            contentType: profileImageFile.type || "image/jpeg",
            buffer: Buffer.from(await profileImageFile.arrayBuffer()),
            prefix: "profile",
          })
          await prisma.user.update({
            where: { id: session.user.id },
            data: { image: imageUrl },
          })
        }
      }

      // Handle Business Reg Certificate
      let busRegCertUrl = seller.businessInfo?.busRegCertUrl
      let cityCouncilCertUrl = seller.businessInfo?.cityCouncilCertUrl
      let gstTinCertUrl = seller.businessInfo?.gstTinCertUrl
      let addressProofUrl = seller.businessInfo?.addressProofUrl

      if (formData) {
        const file = formData.get("busRegCert") as File | null
        if (file && file.size > 0) {
          busRegCertUrl = await uploadPublicFile({
            folder: "hotel-onboarding/business",
            ext: path.extname(file.name) || ".pdf",
            contentType: file.type || "application/pdf",
            buffer: Buffer.from(await file.arrayBuffer()),
            prefix: "hotel-bus-reg",
          })
        }
        const fileCC = formData.get("cityCouncilCert") as File | null
        if (fileCC && fileCC.size > 0) {
          cityCouncilCertUrl = await uploadPublicFile({
            folder: "hotel-onboarding/business",
            ext: path.extname(fileCC.name) || ".pdf",
            contentType: fileCC.type || "application/pdf",
            buffer: Buffer.from(await fileCC.arrayBuffer()),
            prefix: "hotel-city-council",
          })
        }
        const fileGST = formData.get("gstTinCert") as File | null
        if (fileGST && fileGST.size > 0) {
          gstTinCertUrl = await uploadPublicFile({
            folder: "hotel-onboarding/business",
            ext: path.extname(fileGST.name) || ".pdf",
            contentType: fileGST.type || "application/pdf",
            buffer: Buffer.from(await fileGST.arrayBuffer()),
            prefix: "hotel-gst-tin",
          })
        }
        const fileAP = formData.get("addressProof") as File | null
        if (fileAP && fileAP.size > 0) {
          addressProofUrl = await uploadPublicFile({
            folder: "hotel-onboarding/business",
            ext: path.extname(fileAP.name) || ".pdf",
            contentType: fileAP.type || "application/pdf",
            buffer: Buffer.from(await fileAP.arrayBuffer()),
            prefix: "hotel-address-proof",
          })
        }
      } else if (jsonBody?.data) {
        if (jsonBody.data.cityCouncilCertUrl) cityCouncilCertUrl = jsonBody.data.cityCouncilCertUrl
        if (jsonBody.data.gstTinCertUrl) gstTinCertUrl = jsonBody.data.gstTinCertUrl
        if (jsonBody.data.addressProofUrl) addressProofUrl = jsonBody.data.addressProofUrl
      }

      await prisma.hotelBusinessInfo.upsert({
        where: { hotelSellerId: seller.id },
        update: { ...businessData, busRegCertUrl, cityCouncilCertUrl, gstTinCertUrl, addressProofUrl },
        create: { ...businessData, busRegCertUrl, cityCouncilCertUrl, gstTinCertUrl, addressProofUrl, hotelSellerId: seller.id },
      })

    } else if (step === 3) {
      // Step 3: KYC
      const kycData = {
        idType: (formData?.get("idType") as string) || jsonBody?.data?.idType,
        idNumber: (formData?.get("idNumber") as string) || jsonBody?.data?.idNumber,
      }

      let idFrontUrl = seller.kyc?.idFrontUrl
      let idBackUrl = seller.kyc?.idBackUrl
      let selfieUrl = seller.kyc?.selfieUrl

      if (formData) {
        const front = formData.get("idFront") as File | null
        const back = formData.get("idBack") as File | null
        const selfie = formData.get("selfie") as File | null

        if (front && front.size > 0) {
          idFrontUrl = await uploadPublicFile({
            folder: "hotel-onboarding/kyc",
            ext: path.extname(front.name) || ".jpg",
            contentType: front.type || "image/jpeg",
            buffer: Buffer.from(await front.arrayBuffer()),
            prefix: "hotel-id-front",
          })
        }
        if (back && back.size > 0) {
          idBackUrl = await uploadPublicFile({
            folder: "hotel-onboarding/kyc",
            ext: path.extname(back.name) || ".jpg",
            contentType: back.type || "image/jpeg",
            buffer: Buffer.from(await back.arrayBuffer()),
            prefix: "hotel-id-back",
          })
        }
        if (selfie && selfie.size > 0) {
          selfieUrl = await uploadPublicFile({
            folder: "hotel-onboarding/kyc",
            ext: path.extname(selfie.name) || ".jpg",
            contentType: selfie.type || "image/jpeg",
            buffer: Buffer.from(await selfie.arrayBuffer()),
            prefix: "hotel-selfie",
          })
        }
      }

      await prisma.hotelKYC.upsert({
        where: { hotelSellerId: seller.id },
        update: { ...kycData, idFrontUrl, idBackUrl, selfieUrl },
        create: { ...kycData, idFrontUrl, idBackUrl, selfieUrl, hotelSellerId: seller.id },
      })

    } else if (step === 4) {
      // Step 4: Property Setup
      const estimateHotelCount = parseInt((formData?.get("estimateHotelCount") as string) || jsonBody?.data?.estimateHotelCount) || 0
      const estimateRoomCount = parseInt((formData?.get("estimateRoomCount") as string) || jsonBody?.data?.estimateRoomCount) || 0
      const categories = formData ? formData.getAll("categories") : (jsonBody?.data?.categories || [])
      
      let logoUrl = seller.logo
      let bannerUrl = seller.banner
      let mainPhotoUrl = seller.mainPhoto

      if (formData) {
        const logo = formData.get("logo") as File | null
        const banner = formData.get("banner") as File | null
        const photo = formData.get("mainPhoto") as File | null

        if (logo && logo.size > 0) {
          logoUrl = await uploadPublicFile({
            folder: "hotel-onboarding/property",
            ext: path.extname(logo.name) || ".jpg",
            contentType: logo.type || "image/jpeg",
            buffer: Buffer.from(await logo.arrayBuffer()),
            prefix: "hotel-logo",
          })
        }
        if (banner && banner.size > 0) {
          bannerUrl = await uploadPublicFile({
            folder: "hotel-onboarding/property",
            ext: path.extname(banner.name) || ".jpg",
            contentType: banner.type || "image/jpeg",
            buffer: Buffer.from(await banner.arrayBuffer()),
            prefix: "hotel-banner",
          })
        }
        if (photo && photo.size > 0) {
          mainPhotoUrl = await uploadPublicFile({
            folder: "hotel-onboarding/property",
            ext: path.extname(photo.name) || ".jpg",
            contentType: photo.type || "image/jpeg",
            buffer: Buffer.from(await photo.arrayBuffer()),
            prefix: "hotel-main-photo",
          })
        }
      }

      await prisma.hotelSeller.update({
        where: { id: seller.id },
        data: {
          estimateHotelCount,
          estimateRoomCount,
          categories: JSON.stringify(categories),
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
        preferredPayoutMethod: (formData?.get("preferredPayoutMethod") as string) || jsonBody?.data?.preferredPayoutMethod,
      }

      let passbookUrl = seller.bankDetails?.passbookUrl
      let bankLetterUrl = seller.bankDetails?.bankLetterUrl
      if (formData) {
        const file = formData.get("passbook") as File | null
        if (file && file.size > 0) {
          passbookUrl = await uploadPublicFile({
            folder: "hotel-onboarding/bank",
            ext: path.extname(file.name) || ".jpg",
            contentType: file.type || "image/jpeg",
            buffer: Buffer.from(await file.arrayBuffer()),
            prefix: "hotel-bank-passbook",
          })
        }
        const fileBL = formData.get("bankLetter") as File | null
        if (fileBL && fileBL.size > 0) {
          bankLetterUrl = await uploadPublicFile({
            folder: "hotel-onboarding/bank",
            ext: path.extname(fileBL.name) || ".pdf",
            contentType: fileBL.type || "application/pdf",
            buffer: Buffer.from(await fileBL.arrayBuffer()),
            prefix: "hotel-bank-letter",
          })
        }
      }

      await prisma.hotelBankDetails.upsert({
        where: { hotelSellerId: seller.id },
        update: { ...bankData, passbookUrl, bankLetterUrl },
        create: { ...bankData, passbookUrl, bankLetterUrl, hotelSellerId: seller.id },
      })

    } else if (step === 6) {
      // Step 6: Agreement
      const agreementData = jsonBody?.data || {
        agreedToTerms: formData?.get("agreedToTerms") === "on",
        agreedToCommission: formData?.get("agreedToCommission") === "on",
        agreedToPrivacy: formData?.get("agreedToPrivacy") === "on",
      }

      await prisma.hotelAgreement.upsert({
        where: { hotelSellerId: seller.id },
        update: agreementData,
        create: { ...agreementData, hotelSellerId: seller.id },
      })

      // Completion!
      await prisma.hotelSeller.update({
        where: { id: seller.id },
        data: { onboardingCompleted: true, onboardingStep: 7, status: "PENDING", adminFeedback: null },
      })

      await activateHotelFreePlan(seller.id)

      try {
        const fullSeller = await prisma.hotelSeller.findUnique({
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

    // Update current step
    await prisma.hotelSeller.update({
      where: { id: seller.id },
      data: { onboardingStep: Math.max(seller.onboardingStep, step + 1) },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Hotel onboarding API error:", error)
    return NextResponse.json({ error: error.message || "Failed to process onboarding step" }, { status: 500 })
  }
}

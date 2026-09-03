import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { generateSlug } from "@/lib/utils"
import { sendSellerWelcomeEmail, sendAdminNewSellerAlertEmail } from "@/lib/email"
import { formatHearAboutUs } from "@/lib/onboarding-constants"
import { evaluateSellerDocuments } from "@/lib/seller-approval-validation"
import { validateOnboardingFile } from "@/lib/onboarding-file-validation"


export async function GET() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = (await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      agreement: true,
      store: true,
      selectedServiceCategories: true,
      user: {
        select: { image: true, name: true, email: true }
      }
    } as any,
  })) as any

  if (seller) {
    const { getPresignedUrlOrOriginal } = await import("@/lib/s3-presigned")
    if (seller.user?.image) {
      seller.user.image = await getPresignedUrlOrOriginal(seller.user.image)
    }
    if (seller.store?.logo) {
      seller.store.logo = await getPresignedUrlOrOriginal(seller.store.logo)
    }
    if (seller.store?.banner) {
      seller.store.banner = await getPresignedUrlOrOriginal(seller.store.banner)
    }
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
      const [idFront, idBack, selfie] = await Promise.all([
        getPresignedUrlOrOriginal(seller.kyc.idFrontUrl),
        getPresignedUrlOrOriginal(seller.kyc.idBackUrl),
        getPresignedUrlOrOriginal(seller.kyc.selfieUrl)
      ])
      seller.kyc.idFrontUrl = idFront
      seller.kyc.idBackUrl = idBack
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
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { store: true, businessInfo: true, kyc: true, bankDetails: true, user: true } as any
  }) as any

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
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
      const data = formData ? {
        businessName: formData.get("businessName") as string,
        businessType: formData.get("businessType") as string,
        businessRegNumber: formData.get("businessRegNumber") as string,
        taxIdNumber: formData.get("taxIdNumber") as string,
        street: formData.get("street") as string,
        city: formData.get("city") as string,
        district: formData.get("district") as string,
        postalCode: formData.get("postalCode") as string,
        natureOfBusiness: formData.get("natureOfBusiness") as string,
        haveGst: haveGst,
        gstInvNo: haveGst ? (formData.get("gstInvNo") as string) : null,
        gstCustomerName: haveGst ? (formData.get("gstCustomerName") as string) : null,
      } : {
        ...jsonBody.data,
        haveGst: haveGst,
        taxIdNumber: jsonBody.data.taxIdNumber,
        gstInvNo: haveGst ? jsonBody.data.gstInvNo : null,
        gstCustomerName: haveGst ? jsonBody.data.gstCustomerName : null,
      }

      let userImage = seller.user?.image
      if (formData) {
        const profileImageFile = formData.get("profileImage") as File | null
        if (profileImageFile && profileImageFile.size > 0) {
          const val = validateOnboardingFile(profileImageFile, { imagesOnly: true, maxSizeMb: 4.5 })
          if (!val.isValid) {
            return NextResponse.json({ error: `Profile Picture: ${val.error}` }, { status: 400 })
          }
          userImage = await uploadPublicFile({
            folder: "profile",
            ext: path.extname(profileImageFile.name) || ".jpg",
            contentType: profileImageFile.type || "image/jpeg",
            buffer: Buffer.from(await profileImageFile.arrayBuffer()),
            prefix: "profile",
          })
          await prisma.user.update({
            where: { id: session.user.id },
            data: { image: userImage },
          })
        }
      } else if (jsonBody?.data?.image) {
        userImage = jsonBody.data.image
        await prisma.user.update({
          where: { id: session.user.id },
          data: { image: userImage },
        })
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
          busRegCertUrl = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(file.name) || ".pdf",
            contentType: file.type || "application/pdf",
            buffer: Buffer.from(await file.arrayBuffer()),
            prefix: "bus-reg",
          })
        }
        const fileCC = formData.get("cityCouncilCert") as File | null
        if (fileCC && fileCC.size > 0) {
          cityCouncilCertUrl = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(fileCC.name) || ".pdf",
            contentType: fileCC.type || "application/pdf",
            buffer: Buffer.from(await fileCC.arrayBuffer()),
            prefix: "city-council",
          })
        }
        const fileGST = formData.get("gstTinCert") as File | null
        if (fileGST && fileGST.size > 0) {
          gstTinCertUrl = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(fileGST.name) || ".pdf",
            contentType: fileGST.type || "application/pdf",
            buffer: Buffer.from(await fileGST.arrayBuffer()),
            prefix: "gst-tin",
          })
        }
        const fileAP = formData.get("addressProof") as File | null
        if (fileAP && fileAP.size > 0) {
          addressProofUrl = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(fileAP.name) || ".pdf",
            contentType: fileAP.type || "application/pdf",
            buffer: Buffer.from(await fileAP.arrayBuffer()),
            prefix: "address-proof",
          })
        }
      } else if (jsonBody?.data) {
        if (jsonBody.data.busRegCertUrl) busRegCertUrl = jsonBody.data.busRegCertUrl
        if (jsonBody.data.cityCouncilCertUrl) cityCouncilCertUrl = jsonBody.data.cityCouncilCertUrl
        if (jsonBody.data.gstTinCertUrl) gstTinCertUrl = jsonBody.data.gstTinCertUrl
        if (jsonBody.data.addressProofUrl) addressProofUrl = jsonBody.data.addressProofUrl
      }

      if (!busRegCertUrl) {
        return NextResponse.json({ error: "Business Registration Certificate / Trade License is mandatory." }, { status: 400 })
      }
      if (haveGst && !gstTinCertUrl) {
        return NextResponse.json({ error: "GST TIN Certificate is mandatory when selling with GST." }, { status: 400 })
      }

      await (prisma as any).sellerBusinessInfo.upsert({
        where: { sellerId: seller.id },
        update: { ...data, busRegCertUrl, cityCouncilCertUrl, gstTinCertUrl, addressProofUrl },
        create: { ...data, busRegCertUrl, cityCouncilCertUrl, gstTinCertUrl, addressProofUrl, sellerId: seller.id },
      })
    } else if (step === 3) {
      // Step 3: KYC
      const nationIdentityNumber = formData ? (formData.get("nationIdentityNumber") as string) : jsonBody.data.nationIdentityNumber

      const data = formData ? {
        idType: formData.get("idType") as string,
        idNumber: formData.get("idNumber") as string,
      } : jsonBody.data

      if (nationIdentityNumber) {
        await prisma.seller.update({
          where: { id: seller.id },
          data: { nationIdentityNumber },
        })
      }

      let idFrontUrl = seller.kyc?.idFrontUrl
      let idBackUrl = seller.kyc?.idBackUrl
      let selfieUrl = seller.kyc?.selfieUrl

      if (formData) {
        const front = formData.get("idFront") as File | null
        const back = formData.get("idBack") as File | null
        const selfie = formData.get("selfie") as File | null

        for (const [f, label] of [[front, "ID Front"], [back, "ID Back"], [selfie, "Selfie Check"]] as const) {
          if (f && f.size > 0) {
            const val = validateOnboardingFile(f, { imagesOnly: true, maxSizeMb: 4.5 })
            if (!val.isValid) {
              return NextResponse.json({ error: `${label}: ${val.error}` }, { status: 400 })
            }
          }
        }

        if (front && front.size > 0) {
          idFrontUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext: path.extname(front.name) || ".jpg",
            contentType: front.type || "image/jpeg",
            buffer: Buffer.from(await front.arrayBuffer()),
            prefix: "id-front",
          })
        }
        if (back && back.size > 0) {
          idBackUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext: path.extname(back.name) || ".jpg",
            contentType: back.type || "image/jpeg",
            buffer: Buffer.from(await back.arrayBuffer()),
            prefix: "id-back",
          })
        }
        if (selfie && selfie.size > 0) {
          selfieUrl = await uploadPublicFile({
            folder: "onboarding/kyc",
            ext: path.extname(selfie.name) || ".jpg",
            contentType: selfie.type || "image/jpeg",
            buffer: Buffer.from(await selfie.arrayBuffer()),
            prefix: "selfie",
          })
        }
      }

      if (!idFrontUrl) {
        return NextResponse.json({ error: "National ID / Passport Front document is mandatory." }, { status: 400 })
      }
      if (!idBackUrl) {
        return NextResponse.json({ error: "National ID / Passport Back document is mandatory." }, { status: 400 })
      }
      if (!selfieUrl) {
        return NextResponse.json({ error: "Selfie / Face Verification is mandatory." }, { status: 400 })
      }

      await (prisma as any).sellerKYC.upsert({
        where: { sellerId: seller.id },
        update: { ...data, idFrontUrl, idBackUrl, selfieUrl },
        create: { ...data, idFrontUrl, idBackUrl, selfieUrl, sellerId: seller.id },
      })
    } else if (step === 4) {
      // Step 4: Bank Details
      // Step 4: Bank Details
      const rawMethod = (formData ? (formData.get("preferredPayoutMethod") as string) : jsonBody?.data?.preferredPayoutMethod)?.trim()
      const data = formData ? {
        bankName: formData.get("bankName") as string,
        bankAddress: formData.get("bankAddress") as string,
        accountHolderName: formData.get("accountHolderName") as string,
        accountNumber: formData.get("accountNumber") as string,
        bbanNumber: formData.get("bbanNumber") as string,
        branchName: formData.get("branchName") as string,
        mobileMoneyOption: formData.get("mobileMoneyOption") as string,
        preferredPayoutMethod: rawMethod || "Bank Transfer",
      } : {
        ...jsonBody.data,
        preferredPayoutMethod: rawMethod || "Bank Transfer",
      }

      let passbookUrl = seller.bankDetails?.passbookUrl
      let bankLetterUrl = seller.bankDetails?.bankLetterUrl
      if (formData) {
        const file = formData.get("bankPassbook") as File | null
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
          passbookUrl = await uploadPublicFile({
            folder: "onboarding/bank",
            ext: path.extname(file.name) || ".jpg",
            contentType: file.type || "image/jpeg",
            buffer: Buffer.from(await file.arrayBuffer()),
            prefix: "bank-passbook",
          })
        }
        if (fileBL && fileBL.size > 0) {
          bankLetterUrl = await uploadPublicFile({
            folder: "onboarding/bank",
            ext: path.extname(fileBL.name) || ".pdf",
            contentType: fileBL.type || "application/pdf",
            buffer: Buffer.from(await fileBL.arrayBuffer()),
            prefix: "bank-letter",
          })
        }
      } else if (jsonBody?.data) {
        if (jsonBody.data.passbookUrl) passbookUrl = jsonBody.data.passbookUrl
        if (jsonBody.data.bankLetterUrl) bankLetterUrl = jsonBody.data.bankLetterUrl
      }



      await (prisma as any).sellerBankDetails.upsert({
        where: { sellerId: seller.id },
        update: { ...data, passbookUrl, bankLetterUrl },
        create: { ...data, passbookUrl, bankLetterUrl, sellerId: seller.id },
      })
    } else if (step === 5) {
      // Step 5: Store Setup & Service Categories
      let categoryIds = formData ? formData.getAll("categoryIds") : (jsonBody.data.categoryIds || [])
      
      const suggestionCountRaw = formData ? formData.get("suggestionCount") : jsonBody.data.suggestionCount
      const suggestionCount = parseInt(suggestionCountRaw as string) || 0

      for (let i = 0; i < suggestionCount; i++) {
        const suggestedId = formData ? formData.get(`suggestion_id_${i}`) as string : jsonBody.data[`suggestion_id_${i}`]
        const suggestedName = formData ? formData.get(`suggestion_name_${i}`) as string : jsonBody.data[`suggestion_name_${i}`]
        const suggestedDescription = formData ? formData.get(`suggestion_description_${i}`) as string : jsonBody.data[`suggestion_description_${i}`]
        
        let imageUrl: string | undefined = undefined
        let iconUrl: string | undefined = undefined

        if (formData) {
          const imgFile = formData.get(`suggestion_image_${i}`) as File | null
          if (imgFile && imgFile.size > 0) {
            const val = validateOnboardingFile(imgFile, { imagesOnly: true, maxSizeMb: 4.5 })
            if (!val.isValid) {
              return NextResponse.json({ error: `Suggestion Image: ${val.error}` }, { status: 400 })
            }
            imageUrl = await uploadPublicFile({
              folder: "categories/suggestions",
              ext: path.extname(imgFile.name) || ".jpg",
              contentType: imgFile.type || "image/jpeg",
              buffer: Buffer.from(await imgFile.arrayBuffer()),
              prefix: "cat-sug-img",
            })
          }
          const iconFile = formData.get(`suggestion_mobile_icon_${i}`) as File | null
          if (iconFile && iconFile.size > 0) {
            const val = validateOnboardingFile(iconFile, { imagesOnly: true, maxSizeMb: 4.5 })
            if (!val.isValid) {
              return NextResponse.json({ error: `Suggestion Icon: ${val.error}` }, { status: 400 })
            }
            iconUrl = await uploadPublicFile({
              folder: "categories/suggestions",
              ext: path.extname(iconFile.name) || ".png",
              contentType: iconFile.type || "image/png",
              buffer: Buffer.from(await iconFile.arrayBuffer()),
              prefix: "cat-sug-ico",
            })
          }
        } else if (jsonBody?.data) {
          imageUrl = jsonBody.data[`suggestion_image_${i}`]
          iconUrl = jsonBody.data[`suggestion_mobile_icon_${i}`]
        }

        let existing = null
        if (suggestedId) {
          existing = await prisma.serviceCategory.findUnique({ where: { id: suggestedId } })
        }
        if (!existing && suggestedName) {
          existing = await prisma.serviceCategory.findFirst({
            where: {
              OR: [
                { name: { equals: suggestedName, mode: "insensitive" } },
                { slug: generateSlug(suggestedName) }
              ]
            }
          })
        }

        if (existing) {
          if (existing.isActive === false) {
            await prisma.serviceCategory.update({
              where: { id: existing.id },
              data: {
                name: suggestedName || existing.name,
                slug: suggestedName ? generateSlug(suggestedName) : existing.slug,
                description: suggestedDescription ?? existing.description,
                image: imageUrl || existing.image,
                mobileIcon: iconUrl || existing.mobileIcon,
              }
            })
          }
          if (!categoryIds.includes(existing.id)) {
            categoryIds.push(existing.id)
          }
        } else if (suggestedName) {
          let slug = generateSlug(suggestedName)
          const slugExists = await prisma.serviceCategory.findUnique({ where: { slug } })
          if (slugExists) {
            slug = `${slug}-${Date.now()}`
          }

          const newCat = await prisma.serviceCategory.create({
            data: {
              name: suggestedName,
              slug,
              description: suggestedDescription,
              image: imageUrl || null,
              mobileIcon: iconUrl || null,
              isActive: false,
            }
          })
          categoryIds.push(newCat.id)
        }
      }

      const zipCodeRaw = (formData ? (formData.get("zipCode") || formData.get("postalCode")) : (jsonBody?.data?.zipCode || jsonBody?.data?.postalCode)) as string | null
      const latRaw = formData ? formData.get("lat") : jsonBody?.data?.lat
      const lngRaw = formData ? formData.get("lng") : jsonBody?.data?.lng
      const parsedLat = latRaw ? parseFloat(latRaw as string) : null
      const parsedLng = lngRaw ? parseFloat(lngRaw as string) : null

      const storeData: any = {
        name: (formData ? (formData.get("storeName") || formData.get("name")) : (jsonBody?.data?.storeName || jsonBody?.data?.name)) as string || "My Service Store",
        description: (formData ? formData.get("description") : jsonBody?.data?.description) as string | null || null,
        address: (formData ? formData.get("address") : jsonBody?.data?.address) as string | null || null,
        city: (formData ? formData.get("city") : jsonBody?.data?.city) as string | null || null,
        state: (formData ? formData.get("state") : jsonBody?.data?.state) as string | null || null,
        country: (formData ? formData.get("country") : jsonBody?.data?.country) as string | null || null,
        zipCode: zipCodeRaw || null,
        phone: (formData ? formData.get("phone") : jsonBody?.data?.phone) as string | null || null,
        website: (formData ? formData.get("website") : jsonBody?.data?.website) as string | null || null,
        ...(parsedLat !== null && !isNaN(parsedLat) ? { lat: parsedLat } : {}),
        ...(parsedLng !== null && !isNaN(parsedLng) ? { lng: parsedLng } : {}),
      }

      if (formData) {
        const logo = formData.get("storeLogo") as File | null
        const banner = formData.get("storeBanner") as File | null
        for (const [f, label] of [[logo, "Store Logo"], [banner, "Store Banner"]] as const) {
          if (f && f.size > 0) {
            const val = validateOnboardingFile(f, { imagesOnly: true, maxSizeMb: 4.5 })
            if (!val.isValid) {
              return NextResponse.json({ error: `${label}: ${val.error}` }, { status: 400 })
            }
          }
        }
        if (logo && logo.size > 0) {
          storeData.logo = await uploadPublicFile({
            folder: "onboarding/store",
            ext: path.extname(logo.name) || ".jpg",
            contentType: logo.type || "image/jpeg",
            buffer: Buffer.from(await logo.arrayBuffer()),
            prefix: "store-logo",
          })
        }
        if (banner && banner.size > 0) {
          storeData.banner = await uploadPublicFile({
            folder: "onboarding/store",
            ext: path.extname(banner.name) || ".jpg",
            contentType: banner.type || "image/jpeg",
            buffer: Buffer.from(await banner.arrayBuffer()),
            prefix: "store-banner",
          })
        }
      } else if (jsonBody?.data) {
        if (jsonBody.data.logo) storeData.logo = jsonBody.data.logo
        if (jsonBody.data.banner) storeData.banner = jsonBody.data.banner
      }

      const finalLogo = storeData.logo || seller.store?.logo
      if (!finalLogo) {
        return NextResponse.json({ error: "Service Store Logo is mandatory." }, { status: 400 })
      }

      if (seller.store) {
        await prisma.store.update({
          where: { id: seller.store.id },
          data: storeData,
        })
      } else {
        await prisma.store.create({
          data: { ...storeData, sellerId: seller.id },
        })
      }

      if (categoryIds && Array.isArray(categoryIds)) {
        await (prisma as any).seller.update({
          where: { id: seller.id },
          data: {
            selectedServiceCategories: {
              set: categoryIds.map((id: string) => ({ id })),
            },
          } as any,
        })
      }
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
        agreedToReturnPolicy: !!(jsonBody?.data?.agreedToReturnPolicy ?? (formData?.get("agreedToReturnPolicy") === "true" || formData?.get("agreedToReturnPolicy") === "on")),
        agreedToPrivacy: !!(jsonBody?.data?.agreedToPrivacy ?? (formData?.get("agreedToPrivacy") === "true" || formData?.get("agreedToPrivacy") === "on")),
        hearAboutUs: formatHearAboutUs(rawHearAboutUs, rawHearAboutUsOther),
      }
      await (prisma as any).sellerAgreement.upsert({
        where: { sellerId: seller.id },
        update: agreementData,
        create: { ...agreementData, sellerId: seller.id },
      })

      // Strict validation before marking complete
      const verifySeller = await prisma.seller.findUnique({
        where: { id: seller.id },
        include: { businessInfo: true, kyc: true, bankDetails: true, agreement: true, store: true, user: true } as any
      })
      const docEval = evaluateSellerDocuments(verifySeller, "SERVICE")
      if (!docEval.isComplete) {
        return NextResponse.json({
          error: `Cannot complete onboarding: Missing required documents: ${docEval.missingDocuments.join(", ")}`
        }, { status: 400 })
      }

      // Completion!
      await (prisma as any).seller.update({
        where: { id: seller.id },
        data: { onboardingCompleted: true, onboardingStep: 7 } as any,
      })

      try {
        const fullSeller = await prisma.seller.findUnique({
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
    await (prisma as any).seller.update({
      where: { id: seller.id },
      data: { onboardingStep: Math.max(seller.onboardingStep, step + 1) } as any,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Onboarding API error:", error)
    return NextResponse.json({ error: error.message || "Failed to process onboarding step" }, { status: 500 })
  }
}

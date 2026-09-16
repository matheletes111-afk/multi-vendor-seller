import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import path from "path"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"
import { checkDisallowedName } from "@/lib/name-validation"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
import { generateSlug } from "@/lib/utils"
import { validateAndFormatPaymentDetails } from "@/lib/payment-details-helper"

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

/** GET current seller + store + user for settings page. */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      store: true,
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      selectedCategories: true,
      user: {
        select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
      },
    } as any,
  }) as any

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const { getPresignedUrlOrOriginal } = await import("@/lib/s3-presigned")
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

  return NextResponse.json(seller)
}

/** PUT update store and/or user profile. Accepts JSON or FormData (for profile image). */
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { store: true, businessInfo: true, kyc: true, bankDetails: true } as any,
  }) as any

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const contentType = request.headers.get("content-type") ?? ""
  const validatePhoneFields = (phone: string | null | undefined, countryCode: string | null | undefined) => {
    const finalPhone = phone?.trim() || seller.user?.phone || ""
    const finalCountryCode = countryCode?.trim() || seller.user?.phoneCountryCode || "+232"
    if (!finalPhone || !finalCountryCode) {
      return { error: "Phone and country code are required." }
    }
    const validation = validatePhoneAndCountryCode(finalPhone, finalCountryCode)
    if (!validation.isValid) {
      return { error: validation.error || "Invalid phone number or country code." }
    }
    return { cleanedPhone: validation.cleanedPhone, cleanedCountryCode: validation.cleanedCountryCode }
  }

  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData()
    const profileImageFile = fd.get("profileImage") as File | null
    const imageUrl = (fd.get("image") as string)?.trim()
    const name = fd.get("name") !== null ? sanitizeInput(fd.get("name") as string) : undefined
    const emailRaw = fd.get("email") !== null ? (fd.get("email") as string) : null
    const phone = (fd.get("phone") as string) ?? ""
    const phoneCountryCode = (fd.get("phoneCountryCode") as string) ?? ""
    const nationIdentityNumberRaw = fd.get("nationIdentityNumber") as string | null
    const nationIdentityNumber = (nationIdentityNumberRaw ?? "").trim()
    const password = ((fd.get("password") as string | null) ?? "").trim()
    const currentPassword = ((fd.get("currentPassword") as string | null) ?? "").trim()

    const userData: { name?: string; email?: string | null; image?: string | null; phone?: string | null; phoneCountryCode?: string | null; password?: string } = {}
    if (name !== undefined) userData.name = name
    if (emailRaw !== null) {
      const trimmedEmail = emailRaw.trim().toLowerCase()
      if (trimmedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmedEmail)) {
          return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
        }
        const existingUser = await prisma.user.findFirst({
          where: { email: trimmedEmail, NOT: { id: session.user.id } },
        })
        if (existingUser) {
          return NextResponse.json({ error: "This email address is already registered to another account." }, { status: 400 })
        }
        userData.email = trimmedEmail
      } else {
        userData.email = null
      }
    }
    if (phone || phoneCountryCode) {
      const phoneRes = validatePhoneFields(phone, phoneCountryCode)
      if (phoneRes.error) return NextResponse.json({ error: phoneRes.error }, { status: 400 })
      userData.phone = phoneRes.cleanedPhone
      userData.phoneCountryCode = phoneRes.cleanedCountryCode
    }
    if (password) {
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.isValid) {
        return NextResponse.json({ error: passwordValidation.error }, { status: 400 })
      }
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true }
      })
      if (dbUser?.password) {
        if (!currentPassword) {
          return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 })
        }
        const isPasswordCorrect = await bcrypt.compare(currentPassword, dbUser.password)
        if (!isPasswordCorrect) {
          return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
        }
      }
      userData.password = await bcrypt.hash(password, 10)
    }
    const sellerData: { nationIdentityNumber?: string | null } = {}
    // If the form includes the field, treat empty value as null.
    if (nationIdentityNumberRaw !== null) sellerData.nationIdentityNumber = nationIdentityNumber || null

    if (profileImageFile && profileImageFile.size > 0) {
      try {
        const type = profileImageFile.type?.toLowerCase() ?? ""
        if (!type.startsWith("image/")) {
          return NextResponse.json({ error: "Profile picture must be an image file" }, { status: 400 })
        }
        const bytes = await profileImageFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const contentType = profileImageFile.type || "image/jpeg"
        const ext =
          path.extname((profileImageFile as { name?: string }).name || "") || getImageExtFromContentType(contentType)
        userData.image = await uploadPublicFile({
          folder: "profile",
          ext,
          contentType,
          buffer,
          prefix: "profile",
        })
      } catch (e) {
        console.error("Profile image upload error:", e)
        const message = e instanceof Error ? e.message : "Failed to upload profile image"
        return NextResponse.json({ error: message }, { status: 500 })
      }
    } else if (imageUrl !== undefined) {
      userData.image = imageUrl || null
    }

    if (Object.keys(userData).length > 0) {
      if (userData.name) {
        const nameCheck = await checkDisallowedName(userData.name)
        if (!nameCheck.isAllowed) return NextResponse.json({ error: nameCheck.error }, { status: 400 })
      }
      if (userData.phone) {
        const existing = await prisma.user.findFirst({
          where: { phone: userData.phone, NOT: { id: session.user.id } }
        })
        if (existing) return NextResponse.json({ error: "Phone number already in use" }, { status: 400 })
      }
      await prisma.user.update({
        where: { id: session.user.id },
        data: userData,
      })
    }

    if (Object.keys(sellerData).length > 0) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: sellerData,
      })
    }

    // Handle Business Info (text fields + optional file)
    const businessName = fd.get("businessName") as string | null
    const businessType = fd.get("businessType") as string | null
    const businessRegNumber = fd.get("businessRegNumber") as string | null
    const haveGstRaw = fd.get("haveGst") as string | null
    const taxIdNumber = fd.get("taxIdNumber") as string | null
    const gstCustomerName = fd.get("gstCustomerName") as string | null
    const gstInvNo = fd.get("gstInvNo") as string | null
    const street = fd.get("street") as string | null
    const city = fd.get("city") as string | null
    const district = fd.get("district") as string | null
    const state = fd.get("state") as string | null
    const postalCode = fd.get("postalCode") as string | null
    const natureOfBusiness = fd.get("natureOfBusiness") as string | null
    const busLatRaw = fd.get("latitude") as string | null
    const busLngRaw = fd.get("longitude") as string | null

    const busInfoData: any = {}
    if (businessName !== null) busInfoData.businessName = businessName.trim()
    if (businessType !== null) busInfoData.businessType = businessType.trim()
    if (businessRegNumber !== null) busInfoData.businessRegNumber = businessRegNumber.trim()
    if (haveGstRaw !== null) {
      const h = haveGstRaw === "true"
      busInfoData.haveGst = h
      if (!h) {
        // TIN is always required, do NOT clear it
        busInfoData.gstInvNo = null
        busInfoData.gstCustomerName = null
      }
    }
    // TIN is always required regardless of GST status
    if (taxIdNumber !== null) busInfoData.taxIdNumber = taxIdNumber.trim()
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
    const yearsInOpRaw = fd.get("yearsInOperation") as string | null
    if (yearsInOpRaw !== null && yearsInOpRaw !== "" && !isNaN(Number(yearsInOpRaw))) {
      busInfoData.yearsInOperation = parseInt(yearsInOpRaw)
    }
    if (busLatRaw !== null && !isNaN(Number(busLatRaw))) busInfoData.latitude = Number(busLatRaw)
    if (busLngRaw !== null && !isNaN(Number(busLngRaw))) busInfoData.longitude = Number(busLngRaw)

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
        await (prisma as any).sellerBusinessInfo.upsert({
            where: { sellerId: seller.id },
            update: busInfoData,
            create: { ...busInfoData, sellerId: seller.id }
        })
    }

    // Handle KYC Details and Documents
    const idType = fd.get("idType") as string | null
    const idNumber = fd.get("idNumber") as string | null
    const idFront = fd.get("idFront") as File | null
    const idBack = fd.get("idBack") as File | null
    const selfie = fd.get("selfie") as File | null

    const hasKycFields = idType !== null || idNumber !== null || (idFront && idFront.size > 0) || (idBack && idBack.size > 0) || (selfie && selfie.size > 0)

    if (hasKycFields) {
        const kycData: any = {}
        if (idType !== null) kycData.idType = idType.trim()
        if (idNumber !== null) kycData.idNumber = idNumber.trim()

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
            await (prisma as any).sellerKYC.upsert({
                where: { sellerId: seller.id },
                update: kycData,
                create: { ...kycData, sellerId: seller.id }
            })
        }
    }

    const paymentOption = fd.get("paymentOption") as string | null
    const mobileNumber = fd.get("mobileNumber") as string | null
    const agentNumber = fd.get("agentNumber") as string | null
    const bankName = fd.get("bankName") as string | null
    const bankAddress = fd.get("bankAddress") as string | null
    const accountHolderName = fd.get("accountHolderName") as string | null
    const accountNumber = fd.get("accountNumber") as string | null
    const bbanNumber = fd.get("bbanNumber") as string | null
    const branchName = fd.get("branchName") as string | null
    const mobileMoneyOption = fd.get("mobileMoneyOption") as string | null
    const preferredPayoutMethod = fd.get("preferredPayoutMethod") as string | null
    const bankPassbook = fd.get("bankPassbook") as File | null
    const bankLetter = fd.get("bankLetter") as File | null

    const hasBankFields = paymentOption !== null || mobileNumber !== null || agentNumber !== null ||
      bankName !== null || bankAddress !== null || accountHolderName !== null || accountNumber !== null ||
      bbanNumber !== null || branchName !== null || mobileMoneyOption !== null || preferredPayoutMethod !== null ||
      (bankPassbook && bankPassbook.size > 0) || (bankLetter && bankLetter.size > 0)

    if (hasBankFields) {
        let passbookUrl = seller.bankDetails?.passbookUrl || null
        let bankLetterUrl = seller.bankDetails?.bankLetterUrl || null

        if (bankPassbook && bankPassbook.size > 0) {
            passbookUrl = await uploadPublicFile({
                folder: "onboarding/bank",
                ext: path.extname(bankPassbook.name) || ".jpg",
                contentType: bankPassbook.type || "image/jpeg",
                buffer: Buffer.from(await bankPassbook.arrayBuffer()),
                prefix: "bank-passbook",
            })
        }
        if (bankLetter && bankLetter.size > 0) {
            bankLetterUrl = await uploadPublicFile({
                folder: "onboarding/bank",
                ext: path.extname(bankLetter.name) || ".pdf",
                contentType: bankLetter.type || "application/pdf",
                buffer: Buffer.from(await bankLetter.arrayBuffer()),
                prefix: "bank-letter",
            })
        }

        const { data: bankData, error: valErr } = validateAndFormatPaymentDetails({
            paymentOption,
            mobileNumber,
            agentNumber,
            bankName,
            bankAddress,
            accountHolderName,
            accountNumber,
            bbanNumber,
            branchName,
            mobileMoneyOption,
            preferredPayoutMethod,
            passbookUrl,
            bankLetterUrl,
        }, { requireFields: false })

        if (valErr) {
            return NextResponse.json({ error: valErr }, { status: 400 })
        }

        await (prisma as any).sellerBankDetails.upsert({
            where: { sellerId: seller.id },
            update: bankData,
            create: { ...bankData, sellerId: seller.id }
        })
    }

    // Handle Store Visuals & Information
    const storeLogo = fd.get("storeLogo") as File | null
    const storeBanner = fd.get("storeBanner") as File | null
    const storeUpdates: any = {}

    const storeNameRaw = (fd.get("name") || fd.get("storeName")) as string | null
    const storeDescRaw = (fd.get("description") || fd.get("storeDescription")) as string | null
    const storePhoneRaw = (fd.get("storePhone") || fd.get("phone")) as string | null
    const storeWebsiteRaw = (fd.get("storeWebsite") || fd.get("website")) as string | null
    const storeCityRaw = (fd.get("storeCity") || fd.get("city")) as string | null
    const storeStateRaw = (fd.get("storeState") || fd.get("state")) as string | null
    const storeZipCodeRaw = (fd.get("storeZipCode") || fd.get("zipCode")) as string | null
    const storeCountryRaw = (fd.get("storeCountry") || fd.get("country")) as string | null

    if (storeNameRaw !== null && storeNameRaw !== undefined) storeUpdates.name = storeNameRaw.trim()
    if (storeDescRaw !== null && storeDescRaw !== undefined) storeUpdates.description = storeDescRaw.trim()
    if (storePhoneRaw !== null && storePhoneRaw !== undefined) storeUpdates.phone = storePhoneRaw.trim()
    if (storeWebsiteRaw !== null && storeWebsiteRaw !== undefined) storeUpdates.website = storeWebsiteRaw.trim()
    if (storeCityRaw !== null && storeCityRaw !== undefined) storeUpdates.city = storeCityRaw.trim()
    if (storeStateRaw !== null && storeStateRaw !== undefined) storeUpdates.state = storeStateRaw.trim()
    if (storeZipCodeRaw !== null && storeZipCodeRaw !== undefined) storeUpdates.zipCode = storeZipCodeRaw.trim()
    if (storeCountryRaw !== null && storeCountryRaw !== undefined) storeUpdates.country = storeCountryRaw.trim()

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

    const storeLatRaw = (fd.get("storeLat") || fd.get("lat")) as string | null
    const storeLngRaw = (fd.get("storeLng") || fd.get("lng")) as string | null
    const addressRaw = (fd.get("storeAddress") || fd.get("address")) as string | null

    if (addressRaw !== null && addressRaw !== undefined) storeUpdates.address = addressRaw.trim()

    if (storeLatRaw && storeLngRaw) {
        const lat = parseFloat(storeLatRaw)
        const lng = parseFloat(storeLngRaw)
        if (!isNaN(lat) && !isNaN(lng)) {
            storeUpdates.lat = lat
            storeUpdates.lng = lng
        }
    }

    if (Object.keys(storeUpdates).length > 0) {
        if (seller.store) {
            await prisma.store.update({
                where: { id: seller.store.id },
                data: storeUpdates
            })
        } else {
            await prisma.store.create({
                data: { ...storeUpdates, sellerId: seller.id, name: storeUpdates.name || "My Store" }
            })
        }
    }

    const categoryIds = fd.getAll("categoryIds") as string[]

    // Process category suggestions if any
    const suggestionCountRaw = fd.get("suggestionCount")
    const suggestionCount = parseInt(suggestionCountRaw as string) || 0

    for (let i = 0; i < suggestionCount; i++) {
      const suggestedId = (fd.get(`suggestion_id_${i}`) as string)?.trim()
      const suggestedName = (fd.get(`suggestion_name_${i}`) as string)?.trim()
      const suggestedDesc = (fd.get(`suggestion_description_${i}`) as string)?.trim() || null

      if (!suggestedName && !suggestedId) continue

      let existing = null
      if (suggestedId) {
        existing = await prisma.category.findUnique({ where: { id: suggestedId } })
      }
      if (!existing && suggestedName) {
        existing = await prisma.category.findFirst({
          where: {
            OR: [
              { name: { equals: suggestedName, mode: "insensitive" } },
              { slug: generateSlug(suggestedName) }
            ]
          }
        })
      }

      let imageUrl = existing?.image || ""
      let mobileIconUrl = existing?.mobileIcon || ""

      const img = fd.get(`suggestion_image_${i}`) as File | null
      const icon = fd.get(`suggestion_mobile_icon_${i}`) as File | null

      if (img && img.size > 0) {
        imageUrl = await uploadPublicFile({
          folder: "categories",
          ext: path.extname(img.name) || ".jpg",
          contentType: img.type || "image/jpeg",
          buffer: Buffer.from(await img.arrayBuffer()),
          prefix: "category",
        })
      }

      if (icon && icon.size > 0) {
        mobileIconUrl = await uploadPublicFile({
          folder: "categories",
          ext: path.extname(icon.name) || ".png",
          contentType: icon.type || "image/png",
          buffer: Buffer.from(await icon.arrayBuffer()),
          prefix: "mobile",
        })
      }

      if (existing) {
        if (existing.isActive === false) {
          await prisma.category.update({
            where: { id: existing.id },
            data: {
              name: suggestedName || existing.name,
              slug: suggestedName ? generateSlug(suggestedName) : existing.slug,
              description: suggestedDesc ?? existing.description,
              image: imageUrl || existing.image,
              mobileIcon: mobileIconUrl || existing.mobileIcon,
            }
          })
        }
        if (!categoryIds.includes(existing.id)) {
          categoryIds.push(existing.id)
        }
      } else if (suggestedName) {
        let slug = generateSlug(suggestedName)
        const slugExists = await prisma.category.findUnique({ where: { slug } })
        if (slugExists) {
          slug = `${slug}-${Date.now()}`
        }

        const newCat = await prisma.category.create({
          data: {
            name: suggestedName,
            slug,
            description: suggestedDesc,
            image: imageUrl || null,
            mobileIcon: mobileIconUrl || null,
            isActive: false,
          }
        })
        categoryIds.push(newCat.id)
      }
    }

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

    return NextResponse.json({ success: true })
  }

  const body = await request.json().catch(() => ({})) as {
    store?: Record<string, unknown>
    user?: { name?: string; email?: string; image?: string; phone?: string; phoneCountryCode?: string; password?: string; currentPassword?: string }
    seller?: Record<string, any>
    [key: string]: any
  }

  const storeInput = body.store || (body.storeName !== undefined || body.storeDescription !== undefined ? body : null)
  if (storeInput && Object.keys(storeInput).length > 0) {
    const storeData = storeInput as Record<string, unknown>
    const allowed = [
      "name", "description", "phone", "website", "address", "city", "state",
      "zipCode", "country", "logo", "banner", "lat", "lng"
    ]
    const data: any = {}
    for (const key of allowed) {
      if (storeData[key] !== undefined) data[key] = storeData[key]
    }
    if (storeData.storeName !== undefined && data.name === undefined) data.name = storeData.storeName
    if (storeData.storeDescription !== undefined && data.description === undefined) data.description = storeData.storeDescription
    if (storeData.storePhone !== undefined && data.phone === undefined) data.phone = storeData.storePhone
    if (storeData.storeWebsite !== undefined && data.website === undefined) data.website = storeData.storeWebsite
    if (storeData.storeAddress !== undefined && data.address === undefined) data.address = storeData.storeAddress
    if (storeData.storeCity !== undefined && data.city === undefined) data.city = storeData.storeCity
    if (storeData.storeState !== undefined && data.state === undefined) data.state = storeData.storeState
    if (storeData.storeZipCode !== undefined && data.zipCode === undefined) data.zipCode = storeData.storeZipCode
    if (storeData.storeCountry !== undefined && data.country === undefined) data.country = storeData.storeCountry

    if (Object.keys(data).length > 0) {
      if (seller.store) {
        await prisma.store.update({
          where: { id: seller.store.id },
          data,
        })
      } else {
        await prisma.store.create({
          data: {
            sellerId: seller.id,
            name: (data.name as string) || "My Store",
            ...data,
          },
        })
      }
    }
  }

  if (body.user && Object.keys(body.user).length > 0) {
    const userData: { name?: string; email?: string | null; image?: string; phone?: string | null; phoneCountryCode?: string | null; password?: string } = {}
    if (body.user.name !== undefined) {
      userData.name = typeof body.user.name === "string" ? sanitizeInput(body.user.name) : undefined
    }
    if (body.user.email !== undefined) {
      const trimmedEmail = typeof body.user.email === "string" ? body.user.email.trim().toLowerCase() : ""
      if (trimmedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmedEmail)) {
          return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
        }
        const existingUser = await prisma.user.findFirst({
          where: { email: trimmedEmail, NOT: { id: session.user.id } },
        })
        if (existingUser) {
          return NextResponse.json({ error: "This email address is already registered to another account." }, { status: 400 })
        }
        userData.email = trimmedEmail
      } else {
        userData.email = null
      }
    }
    if (body.user.image !== undefined) userData.image = body.user.image
    if (body.user.phone !== undefined || body.user.phoneCountryCode !== undefined) {
      const phoneRes = validatePhoneFields(body.user.phone, body.user.phoneCountryCode)
      if (phoneRes.error) return NextResponse.json({ error: phoneRes.error }, { status: 400 })
      userData.phone = phoneRes.cleanedPhone
      userData.phoneCountryCode = phoneRes.cleanedCountryCode
    }
    if (body.user.password !== undefined) {
      if (typeof body.user.password !== "string") {
        return NextResponse.json({ error: "Password must be a string" }, { status: 400 })
      }
      const password = body.user.password.trim()
      const currentPassword = (body.user.currentPassword ?? "").trim()
      if (password) {
        const passwordValidation = validatePassword(password)
        if (!passwordValidation.isValid) {
          return NextResponse.json({ error: passwordValidation.error }, { status: 400 })
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { password: true }
        })
        if (dbUser?.password) {
          if (!currentPassword) {
            return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 })
          }
          const isPasswordCorrect = await bcrypt.compare(currentPassword, dbUser.password)
          if (!isPasswordCorrect) {
            return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
          }
        }
        userData.password = await bcrypt.hash(password, 10)
      }
    }
    if (Object.keys(userData).length > 0) {
      if (userData.phone) {
        const existing = await prisma.user.findFirst({
          where: { phone: userData.phone, NOT: { id: session.user.id } }
        })
        if (existing) return NextResponse.json({ error: "Phone number already in use" }, { status: 400 })
      }
      await prisma.user.update({
        where: { id: session.user.id },
        data: userData,
      })
    }
  }

  if (body.seller && Object.keys(body.seller).length > 0) {
    const s = body.seller as any
    if (s.businessInfo) {
      const allowedBusFields = [
        "businessName", "businessType", "businessRegNumber", "taxIdNumber",
        "busRegCertUrl", "cityCouncilCertUrl", "gstTinCertUrl", "addressProofUrl",
        "street", "city", "district", "postalCode", "state", "natureOfBusiness",
        "haveGst", "gstInvNo", "gstCustomerName", "latitude", "longitude", "yearsInOperation"
      ]
      const cleanBusInfo: any = {}
      for (const key of allowedBusFields) {
        if (s.businessInfo[key] !== undefined && (typeof s.businessInfo[key] !== "object" || s.businessInfo[key] === null)) {
          cleanBusInfo[key] = s.businessInfo[key]
        }
      }
      if (s.businessInfo.haveGst !== undefined) {
        const h = s.businessInfo.haveGst === "true" || s.businessInfo.haveGst === true
        cleanBusInfo.haveGst = h
        if (!h) {
          cleanBusInfo.gstInvNo = null
          cleanBusInfo.gstCustomerName = null
        }
      }
      if (cleanBusInfo.yearsInOperation !== undefined && cleanBusInfo.yearsInOperation !== null && cleanBusInfo.yearsInOperation !== "") {
        cleanBusInfo.yearsInOperation = parseInt(cleanBusInfo.yearsInOperation)
      }
      if (cleanBusInfo.latitude !== undefined && cleanBusInfo.latitude !== null && cleanBusInfo.latitude !== "") {
        cleanBusInfo.latitude = Number(cleanBusInfo.latitude)
      }
      if (cleanBusInfo.longitude !== undefined && cleanBusInfo.longitude !== null && cleanBusInfo.longitude !== "") {
        cleanBusInfo.longitude = Number(cleanBusInfo.longitude)
      }
      if (Object.keys(cleanBusInfo).length > 0) {
        await (prisma as any).sellerBusinessInfo.upsert({
          where: { sellerId: seller.id },
          update: cleanBusInfo,
          create: { ...cleanBusInfo, sellerId: seller.id }
        })
      }
    }
    if (s.bankDetails) {
        const existingBank = seller.bankDetails
        const bankInput = {
            ...s.bankDetails,
            passbookUrl: s.bankDetails.passbookUrl !== undefined ? s.bankDetails.passbookUrl : (existingBank?.passbookUrl || null),
            bankLetterUrl: s.bankDetails.bankLetterUrl !== undefined ? s.bankDetails.bankLetterUrl : (existingBank?.bankLetterUrl || null),
        }
        const { data: bankData, error: valErr } = validateAndFormatPaymentDetails(bankInput, { requireFields: false })
        if (valErr) {
            return NextResponse.json({ error: valErr }, { status: 400 })
        }
        await (prisma as any).sellerBankDetails.upsert({
            where: { sellerId: seller.id },
            update: bankData,
            create: { ...bankData, sellerId: seller.id }
        })
    }
    if (s.kyc) {
      const allowedKycFields = ["idType", "idNumber", "idFrontUrl", "idBackUrl", "selfieUrl"]
      const cleanKyc: any = {}
      for (const key of allowedKycFields) {
        if (typeof s.kyc[key] === "string") {
          cleanKyc[key] = s.kyc[key].trim() || null
        }
      }
      if (Object.keys(cleanKyc).length > 0) {
        await (prisma as any).sellerKYC.upsert({
          where: { sellerId: seller.id },
          update: cleanKyc,
          create: { ...cleanKyc, sellerId: seller.id }
        })
      }
    }

    const sellerData: any = {}
    if (body.seller.nationIdentityNumber !== undefined) {
      const raw = body.seller.nationIdentityNumber ?? ""
      sellerData.nationIdentityNumber = typeof raw === "string" ? raw.trim() || null : null
    }

    if (body.seller.categoryIds && Array.isArray(body.seller.categoryIds)) {
        sellerData.selectedCategories = {
            set: body.seller.categoryIds.map((id: string) => ({ id }))
        }
    }

    if (Object.keys(sellerData).length > 0) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: sellerData,
      })
    }
  }

  return NextResponse.json({ success: true })
}

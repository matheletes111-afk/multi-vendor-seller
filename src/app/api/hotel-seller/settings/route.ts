import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import path from "path"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"
import { checkDisallowedName } from "@/lib/name-validation"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
import { validateAndFormatPaymentDetails } from "@/lib/payment-details-helper"

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

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
        select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
      },
    },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
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

  return NextResponse.json(seller)
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_HOTEL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id },
    include: { businessInfo: true, kyc: true, bankDetails: true }
  })

  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const contentType = request.headers.get("content-type") ?? ""
  const isMultipart = contentType.includes("multipart/form-data")
  let fd: FormData | null = null
  let body: any = null

  if (isMultipart) {
    fd = await request.formData()
  } else {
    body = await request.json().catch(() => ({}))
  }

  const getVal = (key: string): any => {
    if (fd) return fd.get(key)
    return body?.[key] ?? body?.data?.[key]
  }

  const section = (getVal("section") as string) || (body?.section as string) || ""

  const hasUser = section === "user" || !!body?.user
  const hasBusiness = section === "business" || !!body?.business || !!body?.businessInfo
  const hasKyc = section === "kyc" || !!body?.kyc
  const hasBank = section === "bank" || !!body?.bankDetails || !!body?.bank
  const hasProperty = section === "property" || section === "hotel" || !!body?.hotel || !!body?.property

  // 1. Handle User Profile
  if (hasUser) {
    const userObj = body?.user || {}
    const nameRaw = fd ? fd.get("name") : (userObj.name !== undefined ? userObj.name : getVal("name"))
    const name = nameRaw !== null && nameRaw !== undefined ? sanitizeInput(nameRaw as string) : undefined
    const phone = ((fd ? fd.get("phone") : (userObj.phone ?? getVal("phone"))) as string)?.trim()
    const phoneCountryCode = ((fd ? fd.get("phoneCountryCode") : (userObj.phoneCountryCode ?? getVal("phoneCountryCode"))) as string)?.trim()
    const password = ((fd ? fd.get("password") : (userObj.password ?? getVal("password"))) as string)?.trim()
    const currentPassword = ((fd ? fd.get("currentPassword") : (userObj.currentPassword ?? getVal("currentPassword"))) as string)?.trim() || ""
    const profileImageFile = fd ? (fd.get("profileImage") as File | null) : null

    const userData: any = {}
    if (name) {
      const nameCheck = await checkDisallowedName(name)
      if (!nameCheck.isAllowed) return NextResponse.json({ error: nameCheck.error }, { status: 400 })
      userData.name = name
    }
    if (phone || phoneCountryCode) {
      const validation = validatePhoneAndCountryCode(phone || "", phoneCountryCode || "")
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error || "Invalid phone number or country code." }, { status: 400 })
      }
      userData.phone = validation.cleanedPhone
      userData.phoneCountryCode = validation.cleanedCountryCode

      const existing = await prisma.user.findFirst({
        where: { phone: userData.phone, NOT: { id: session.user.id } }
      })
      if (existing) return NextResponse.json({ error: "Phone number already in use" }, { status: 400 })
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

    if (profileImageFile && profileImageFile.size > 0) {
      const ext = path.extname(profileImageFile.name) || getImageExtFromContentType(profileImageFile.type)
      userData.image = await uploadPublicFile({
        folder: "profile",
        ext,
        contentType: profileImageFile.type,
        buffer: Buffer.from(await profileImageFile.arrayBuffer()),
        prefix: "profile",
      })
    } else if (!fd && userObj.image !== undefined) {
      userData.image = userObj.image
    }

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: session.user.id }, data: userData })
    }
  }

  // 2. Handle Business Info
  if (hasBusiness) {
    const busObj = body?.businessInfo || body?.business || {}
    const getBus = (k: string) => fd ? (fd.get(k) as string) : (busObj[k] ?? getVal(k))

    const businessName = (getBus("businessName") as string)?.trim()
    const businessType = (getBus("businessType") as string)?.trim()
    const taxIdNumber = (getBus("taxIdNumber") as string)?.trim()
    const haveGstRaw = getBus("haveGst")
    const gstInvNo = (getBus("gstInvNo") as string)?.trim()
    const gstCustomerName = (getBus("gstCustomerName") as string)?.trim()
    const landmark = (getBus("landmark") as string)?.trim()
    const street = (getBus("street") as string)?.trim()
    const city = (getBus("city") as string)?.trim()
    const district = (getBus("district") as string)?.trim()
    const state = (getBus("state") as string)?.trim()
    const managerName = (getBus("managerName") as string)?.trim()
    const pocContact = (getBus("pocContact") as string)?.trim()
    const latRaw = getBus("latitude")
    const lngRaw = getBus("longitude")
    const latitude = latRaw != null && !isNaN(Number(latRaw)) ? Number(latRaw) : undefined
    const longitude = lngRaw != null && !isNaN(Number(lngRaw)) ? Number(lngRaw) : undefined

    const busData: any = {}
    if (businessName) busData.businessName = businessName
    if (businessType) busData.businessType = businessType
    if (taxIdNumber) busData.taxIdNumber = taxIdNumber
    if (landmark) busData.landmark = landmark
    if (street) busData.street = street
    if (city) busData.city = city
    if (district) busData.district = district
    if (state) busData.state = state
    if (managerName) busData.managerName = managerName
    if (pocContact) busData.pocContact = pocContact
    if (latitude !== undefined) busData.latitude = latitude
    if (longitude !== undefined) busData.longitude = longitude

    if (haveGstRaw !== null && haveGstRaw !== undefined) {
      const h = haveGstRaw === "true" || haveGstRaw === true
      busData.haveGst = h
      busData.gstInvNo = h ? gstInvNo : null
      busData.gstCustomerName = h ? gstCustomerName : null
    }

    if (fd) {
      const busRegCert = fd.get("busRegCert") as File | null
      const cityCouncilCert = fd.get("cityCouncilCert") as File | null
      const gstTinCert = fd.get("gstTinCert") as File | null
      const addressProof = fd.get("addressProof") as File | null

      if (busRegCert && busRegCert.size > 0) {
        busData.busRegCertUrl = await uploadPublicFile({
          folder: "hotel-onboarding/business",
          ext: path.extname(busRegCert.name) || ".pdf",
          contentType: busRegCert.type,
          buffer: Buffer.from(await busRegCert.arrayBuffer()),
          prefix: "hotel-bus-reg",
        })
      }
      if (cityCouncilCert && cityCouncilCert.size > 0) {
        busData.cityCouncilCertUrl = await uploadPublicFile({
          folder: "hotel-onboarding/business",
          ext: path.extname(cityCouncilCert.name) || ".pdf",
          contentType: cityCouncilCert.type,
          buffer: Buffer.from(await cityCouncilCert.arrayBuffer()),
          prefix: "hotel-city-council",
        })
      }
      if (gstTinCert && gstTinCert.size > 0) {
        busData.gstTinCertUrl = await uploadPublicFile({
          folder: "hotel-onboarding/business",
          ext: path.extname(gstTinCert.name) || ".pdf",
          contentType: gstTinCert.type,
          buffer: Buffer.from(await gstTinCert.arrayBuffer()),
          prefix: "hotel-gst-tin",
        })
      }
      if (addressProof && addressProof.size > 0) {
        busData.addressProofUrl = await uploadPublicFile({
          folder: "hotel-onboarding/business",
          ext: path.extname(addressProof.name) || ".pdf",
          contentType: addressProof.type,
          buffer: Buffer.from(await addressProof.arrayBuffer()),
          prefix: "hotel-address-proof",
        })
      }
    } else {
      const b = (k: string) => (getBus(k) !== undefined && typeof getBus(k) === "string") ? (getBus(k) as string).trim() : undefined
      if (b("busRegCertUrl")) busData.busRegCertUrl = b("busRegCertUrl")
      if (b("cityCouncilCertUrl")) busData.cityCouncilCertUrl = b("cityCouncilCertUrl")
      if (b("gstTinCertUrl")) busData.gstTinCertUrl = b("gstTinCertUrl")
      if (b("addressProofUrl")) busData.addressProofUrl = b("addressProofUrl")
    }

    if (Object.keys(busData).length > 0) {
      await prisma.hotelBusinessInfo.upsert({
        where: { hotelSellerId: seller.id },
        update: busData,
        create: { ...busData, hotelSellerId: seller.id }
      })
    }
  }

  // 3. Handle KYC
  if (hasKyc) {
    const kycObj = body?.kyc || {}
    const getKyc = (k: string) => fd ? (fd.get(k) as string) : (kycObj[k] ?? getVal(k))

    const idType = (getKyc("idType") as string)?.trim()
    const idNumber = (getKyc("idNumber") as string)?.trim()

    const kycData: any = {}
    if (idType) kycData.idType = idType
    if (idNumber) kycData.idNumber = idNumber

    if (fd) {
      const idFront = fd.get("idFront") as File | null
      const idBack = fd.get("idBack") as File | null
      const selfie = fd.get("selfie") as File | null

      if (idFront && idFront.size > 0) kycData.idFrontUrl = await uploadPublicFile({ folder: "hotel-onboarding/kyc", ext: path.extname(idFront.name), contentType: idFront.type, buffer: Buffer.from(await idFront.arrayBuffer()), prefix: "hotel-id-front" })
      if (idBack && idBack.size > 0) kycData.idBackUrl = await uploadPublicFile({ folder: "hotel-onboarding/kyc", ext: path.extname(idBack.name), contentType: idBack.type, buffer: Buffer.from(await idBack.arrayBuffer()), prefix: "hotel-id-back" })
      if (selfie && selfie.size > 0) kycData.selfieUrl = await uploadPublicFile({ folder: "hotel-onboarding/kyc", ext: path.extname(selfie.name), contentType: selfie.type, buffer: Buffer.from(await selfie.arrayBuffer()), prefix: "hotel-selfie" })
    } else {
      const k = (key: string) => (getKyc(key) !== undefined && typeof getKyc(key) === "string") ? (getKyc(key) as string).trim() : undefined
      if (k("idFrontUrl")) kycData.idFrontUrl = k("idFrontUrl")
      if (k("idBackUrl")) kycData.idBackUrl = k("idBackUrl")
      if (k("selfieUrl")) kycData.selfieUrl = k("selfieUrl")
    }

    if (Object.keys(kycData).length > 0) {
      await prisma.hotelKYC.upsert({
        where: { hotelSellerId: seller.id },
        update: kycData,
        create: { ...kycData, hotelSellerId: seller.id }
      })
    }
  }

  // 4. Handle Bank
  if (hasBank) {
    const bankObj = body?.bankDetails || body?.bank || {}
    const getBank = (k: string) => fd ? (fd.get(k) as string) : (bankObj[k] ?? getVal(k))

    const paymentOption = getBank("paymentOption") as string | null
    const mobileNumber = getBank("mobileNumber") as string | null
    const agentNumber = getBank("agentNumber") as string | null
    const bankName = getBank("bankName") as string | null
    const bankAddress = getBank("bankAddress") as string | null
    const accountHolderName = getBank("accountHolderName") as string | null
    const accountNumber = getBank("accountNumber") as string | null
    const bbanNumber = getBank("bbanNumber") as string | null
    const branchName = getBank("branchName") as string | null
    const mobileMoneyOption = getBank("mobileMoneyOption") as string | null
    const preferredPayoutMethod = getBank("preferredPayoutMethod") as string | null

    let passbookUrl = seller.bankDetails?.passbookUrl || null
    let bankLetterUrl = seller.bankDetails?.bankLetterUrl || null

    if (fd) {
      const passbook = (fd.get("passbook") || fd.get("bankPassbook")) as File | null
      const bankLetter = fd.get("bankLetter") as File | null

      if (passbook && passbook.size > 0) {
        passbookUrl = await uploadPublicFile({
          folder: "hotel-onboarding/bank",
          ext: path.extname(passbook.name),
          contentType: passbook.type,
          buffer: Buffer.from(await passbook.arrayBuffer()),
          prefix: "hotel-bank-passbook",
        })
      }
      if (bankLetter && bankLetter.size > 0) {
        bankLetterUrl = await uploadPublicFile({
          folder: "hotel-onboarding/bank",
          ext: path.extname(bankLetter.name) || ".pdf",
          contentType: bankLetter.type || "application/pdf",
          buffer: Buffer.from(await bankLetter.arrayBuffer()),
          prefix: "hotel-bank-letter",
        })
      }
    } else {
      if (getBank("passbookUrl") !== undefined) passbookUrl = getBank("passbookUrl")
      if (getBank("bankLetterUrl") !== undefined) bankLetterUrl = getBank("bankLetterUrl")
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

    await prisma.hotelBankDetails.upsert({
      where: { hotelSellerId: seller.id },
      update: bankData as any,
      create: { ...bankData, hotelSellerId: seller.id } as any,
    })
  }

  // 5. Handle Property Visuals
  if (hasProperty) {
    const propObj = body?.hotel || body?.property || {}
    const getProp = (k: string) => fd ? (fd.get(k) as string) : (propObj[k] ?? getVal(k))

    const countRaw = getProp("estimateHotelCount")
    const estimateHotelCount = countRaw ? parseInt(countRaw as string) : NaN
    const roomRaw = getProp("estimateRoomCount")
    const estimateRoomCount = roomRaw ? parseInt(roomRaw as string) : NaN
    const categories = fd ? fd.getAll("categories") : (Array.isArray(propObj.categories) ? propObj.categories : (Array.isArray(getVal("categories")) ? getVal("categories") : []))

    const propData: any = {}
    if (!isNaN(estimateHotelCount)) propData.estimateHotelCount = estimateHotelCount
    if (!isNaN(estimateRoomCount)) propData.estimateRoomCount = estimateRoomCount
    if (categories.length > 0) propData.categories = JSON.stringify(categories)

    if (fd) {
      const logo = fd.get("logo") as File | null
      const banner = fd.get("banner") as File | null
      const mainPhoto = fd.get("mainPhoto") as File | null

      if (logo && logo.size > 0) propData.logo = await uploadPublicFile({ folder: "hotel-onboarding/property", ext: path.extname(logo.name), contentType: logo.type, buffer: Buffer.from(await logo.arrayBuffer()), prefix: "hotel-logo" })
      if (banner && banner.size > 0) propData.banner = await uploadPublicFile({ folder: "hotel-onboarding/property", ext: path.extname(banner.name), contentType: banner.type, buffer: Buffer.from(await banner.arrayBuffer()), prefix: "hotel-banner" })
      if (mainPhoto && mainPhoto.size > 0) propData.mainPhoto = await uploadPublicFile({ folder: "hotel-onboarding/property", ext: path.extname(mainPhoto.name), contentType: mainPhoto.type, buffer: Buffer.from(await mainPhoto.arrayBuffer()), prefix: "hotel-main-photo" })
    } else {
      const p = (key: string) => (getProp(key) !== undefined && typeof getProp(key) === "string") ? (getProp(key) as string).trim() : undefined
      if (p("logo")) propData.logo = p("logo")
      if (p("banner")) propData.banner = p("banner")
      if (p("mainPhoto")) propData.mainPhoto = p("mainPhoto")
    }

    if (Object.keys(propData).length > 0) {
      await prisma.hotelSeller.update({
        where: { id: seller.id },
        data: propData
      })
    }
  }

  if (!hasUser && !hasBusiness && !hasKyc && !hasBank && !hasProperty) {
    return NextResponse.json({ error: "Invalid section or empty request" }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

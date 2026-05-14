import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import path from "path"
import bcrypt from "bcryptjs"
import { uploadPublicFile } from "@/lib/upload-public-file"

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
  
  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData()
    const section = fd.get("section") as string

    // 1. Handle User Profile
    if (section === "user") {
        const name = (fd.get("name") as string)?.trim()
        const phone = (fd.get("phone") as string)?.trim()
        const phoneCountryCode = (fd.get("phoneCountryCode") as string)?.trim()
        const password = (fd.get("password") as string)?.trim()
        const profileImageFile = fd.get("profileImage") as File | null

        const userData: any = {}
        if (name) userData.name = name
        if (phone) userData.phone = phone
        if (phoneCountryCode) userData.phoneCountryCode = phoneCountryCode
        if (password) {
            if (password.length < 6) return NextResponse.json({ error: "Password too short" }, { status: 400 })
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
            await prisma.user.update({ where: { id: session.user.id }, data: userData })
        }
    }

    // 2. Handle Business Info
    if (section === "business") {
        const businessName = (fd.get("businessName") as string)?.trim()
        const businessType = (fd.get("businessType") as string)?.trim()
        const taxIdNumber = (fd.get("taxIdNumber") as string)?.trim()
        const haveGstRaw = fd.get("haveGst") as string
        const gstInvNo = (fd.get("gstInvNo") as string)?.trim()
        const gstCustomerName = (fd.get("gstCustomerName") as string)?.trim()
        const landmark = (fd.get("landmark") as string)?.trim()
        const city = (fd.get("city") as string)?.trim()
        const state = (fd.get("state") as string)?.trim()
        const busRegCert = fd.get("busRegCert") as File | null

        const managerName = (fd.get("managerName") as string)?.trim()
        const pocContact = (fd.get("pocContact") as string)?.trim()

        const busData: any = {
            businessName, businessType, taxIdNumber, landmark, city, state, managerName, pocContact
        }
        if (haveGstRaw !== null) {
            const h = haveGstRaw === "true"
            busData.haveGst = h
            busData.gstInvNo = h ? gstInvNo : null
            busData.gstCustomerName = h ? gstCustomerName : null
        }

        if (busRegCert && busRegCert.size > 0) {
            busData.busRegCertUrl = await uploadPublicFile({
                folder: "hotel-onboarding/business",
                ext: path.extname(busRegCert.name) || ".pdf",
                contentType: busRegCert.type,
                buffer: Buffer.from(await busRegCert.arrayBuffer()),
                prefix: "hotel-bus-reg",
            })
        }

        await prisma.hotelBusinessInfo.upsert({
            where: { hotelSellerId: seller.id },
            update: busData,
            create: { ...busData, hotelSellerId: seller.id }
        })
    }

    // 3. Handle KYC
    if (section === "kyc") {
        const idType = (fd.get("idType") as string)?.trim()
        const idNumber = (fd.get("idNumber") as string)?.trim()
        const idFront = fd.get("idFront") as File | null
        const idBack = fd.get("idBack") as File | null
        const selfie = fd.get("selfie") as File | null

        const kycData: any = { idType, idNumber }

        if (idFront && idFront.size > 0) kycData.idFrontUrl = await uploadPublicFile({ folder: "hotel-onboarding/kyc", ext: path.extname(idFront.name), contentType: idFront.type, buffer: Buffer.from(await idFront.arrayBuffer()), prefix: "hotel-id-front" })
        if (idBack && idBack.size > 0) kycData.idBackUrl = await uploadPublicFile({ folder: "hotel-onboarding/kyc", ext: path.extname(idBack.name), contentType: idBack.type, buffer: Buffer.from(await idBack.arrayBuffer()), prefix: "hotel-id-back" })
        if (selfie && selfie.size > 0) kycData.selfieUrl = await uploadPublicFile({ folder: "hotel-onboarding/kyc", ext: path.extname(selfie.name), contentType: selfie.type, buffer: Buffer.from(await selfie.arrayBuffer()), prefix: "hotel-selfie" })

        await prisma.hotelKYC.upsert({
            where: { hotelSellerId: seller.id },
            update: kycData,
            create: { ...kycData, hotelSellerId: seller.id }
        })
    }

    // 4. Handle Bank
    if (section === "bank") {
        const bankName = (fd.get("bankName") as string)?.trim()
        const accountHolderName = (fd.get("accountHolderName") as string)?.trim()
        const accountNumber = (fd.get("accountNumber") as string)?.trim()
        const branchName = (fd.get("branchName") as string)?.trim()
        const passbook = fd.get("passbook") as File | null

        const bankData: any = { bankName, accountHolderName, accountNumber, branchName }

        if (passbook && passbook.size > 0) {
            bankData.passbookUrl = await uploadPublicFile({
                folder: "hotel-onboarding/bank",
                ext: path.extname(passbook.name),
                contentType: passbook.type,
                buffer: Buffer.from(await passbook.arrayBuffer()),
                prefix: "hotel-bank-passbook",
            })
        }

        await prisma.hotelBankDetails.upsert({
            where: { hotelSellerId: seller.id },
            update: bankData,
            create: { ...bankData, hotelSellerId: seller.id }
        })
    }

    // 5. Handle Property Visuals
    if (section === "property") {
        const estimateHotelCount = parseInt(fd.get("estimateHotelCount") as string)
        const estimateRoomCount = parseInt(fd.get("estimateRoomCount") as string)
        const categories = fd.getAll("categories")
        const logo = fd.get("logo") as File | null
        const banner = fd.get("banner") as File | null
        const mainPhoto = fd.get("mainPhoto") as File | null

        const propData: any = {}
        if (!isNaN(estimateHotelCount)) propData.estimateHotelCount = estimateHotelCount
        if (!isNaN(estimateRoomCount)) propData.estimateRoomCount = estimateRoomCount
        if (categories.length > 0) propData.categories = JSON.stringify(categories)

        if (logo && logo.size > 0) propData.logo = await uploadPublicFile({ folder: "hotel-onboarding/property", ext: path.extname(logo.name), contentType: logo.type, buffer: Buffer.from(await logo.arrayBuffer()), prefix: "hotel-logo" })
        if (banner && banner.size > 0) propData.banner = await uploadPublicFile({ folder: "hotel-onboarding/property", ext: path.extname(banner.name), contentType: banner.type, buffer: Buffer.from(await banner.arrayBuffer()), prefix: "hotel-banner" })
        if (mainPhoto && mainPhoto.size > 0) propData.mainPhoto = await uploadPublicFile({ folder: "hotel-onboarding/property", ext: path.extname(mainPhoto.name), contentType: mainPhoto.type, buffer: Buffer.from(await mainPhoto.arrayBuffer()), prefix: "hotel-main-photo" })

        if (Object.keys(propData).length > 0) {
            await prisma.hotelSeller.update({
                where: { id: seller.id },
                data: propData
            })
        }
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 })
}

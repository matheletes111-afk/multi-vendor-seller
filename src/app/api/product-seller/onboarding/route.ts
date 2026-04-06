import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"

export async function GET() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      agreement: true,
      store: true,
      selectedCategories: true,
    } as any,
  })

  return NextResponse.json(seller)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { store: true, businessInfo: true, kyc: true, bankDetails: true } as any
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
      const data = formData ? {
        businessName: formData.get("businessName") as string,
        businessType: formData.get("businessType") as string,
        businessRegNumber: formData.get("businessRegNumber") as string,
        taxIdNumber: formData.get("taxIdNumber") as string,
        street: formData.get("street") as string,
        city: formData.get("city") as string,
        district: formData.get("district") as string,
        postalCode: formData.get("postalCode") as string,
        yearsInOperation: parseInt(formData.get("yearsInOperation") as string, 10) || 0,
        natureOfBusiness: formData.get("natureOfBusiness") as string,
      } : jsonBody.data

      const nationIdentityNumber = formData ? (formData.get("nationIdentityNumber") as string) : jsonBody.data.nationIdentityNumber

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

      let busRegCertUrl = seller.businessInfo?.busRegCertUrl
      if (formData) {
        const file = formData.get("busRegCert") as File | null
        if (file && file.size > 0) {
          const buffer = Buffer.from(await file.arrayBuffer())
          busRegCertUrl = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(file.name) || ".pdf",
            contentType: file.type || "application/pdf",
            buffer,
            prefix: "bus-reg",
          })
        }
      }

      await (prisma as any).sellerBusinessInfo.upsert({
        where: { sellerId: seller.id },
        update: { ...data, busRegCertUrl } as any,
        create: { ...data, busRegCertUrl, sellerId: seller.id } as any,
      })

      if (nationIdentityNumber) {
        await prisma.seller.update({
          where: { id: seller.id },
          data: { nationIdentityNumber },
        })
      }
    } else if (step === 3) {
      // Step 3: KYC
      const data = formData ? {
        idType: formData.get("idType") as string,
        idNumber: formData.get("idNumber") as string,
      } : jsonBody.data

      let idFrontUrl = seller.kyc?.idFrontUrl
      let idBackUrl = seller.kyc?.idBackUrl
      let selfieUrl = seller.kyc?.selfieUrl

      if (formData) {
        const front = formData.get("idFront") as File | null
        const back = formData.get("idBack") as File | null
        const selfie = formData.get("selfie") as File | null

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

      await (prisma as any).sellerKYC.upsert({
        where: { sellerId: seller.id },
        update: { ...data, idFrontUrl, idBackUrl, selfieUrl } as any,
        create: { ...data, idFrontUrl, idBackUrl, selfieUrl, sellerId: seller.id } as any,
      })
    } else if (step === 4) {
      // Step 4: Bank Details
      const data = formData ? {
        bankName: formData.get("bankName") as string,
        accountHolderName: formData.get("accountHolderName") as string,
        accountNumber: formData.get("accountNumber") as string,
        branchName: formData.get("branchName") as string,
        mobileMoneyOption: formData.get("mobileMoneyOption") as string,
        preferredPayoutMethod: formData.get("preferredPayoutMethod") as string,
      } : jsonBody.data

      let passbookUrl = seller.bankDetails?.passbookUrl
      if (formData) {
        const file = formData.get("bankPassbook") as File | null
        if (file && file.size > 0) {
          passbookUrl = await uploadPublicFile({
            folder: "onboarding/bank",
            ext: path.extname(file.name) || ".jpg",
            contentType: file.type || "image/jpeg",
            buffer: Buffer.from(await file.arrayBuffer()),
            prefix: "bank-passbook",
          })
        }
      }

      await (prisma as any).sellerBankDetails.upsert({
        where: { sellerId: seller.id },
        update: { ...data, passbookUrl } as any,
        create: { ...data, passbookUrl, sellerId: seller.id } as any,
      })
    } else if (step === 5) {
      // Step 5: Store Setup & Categories
      const data = jsonBody.data
      const { categoryIds, ...storeData } = data

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
            selectedCategories: {
              set: categoryIds.map((id: string) => ({ id })),
            },
          } as any,
        })
      }
    } else if (step === 6) {
      // Step 6: Agreement
      const data = jsonBody.data
      await (prisma as any).sellerAgreement.upsert({
        where: { sellerId: seller.id },
        update: data as any,
        create: { ...data, sellerId: seller.id } as any,
      })

      // Completion!
      await (prisma as any).seller.update({
        where: { id: seller.id },
        data: { onboardingCompleted: true, onboardingStep: 7 } as any,
      })

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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileAuth } from "@/lib/mobile-auth-server";
import { uploadPublicFile } from "@/lib/upload-public-file";
import { UserRole } from "@prisma/client";
import path from "path";

/**
 * GET /mobileapi/service-seller/onboarding
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_SERVICE);
  if (!auth.success) return auth.errorResponse;

  const { seller } = auth;
  const mobileStep = Math.max(1, seller.onboardingStep - 1);

  return NextResponse.json({
    success: true,
    data: {
      user: auth.user,
      onboardingCompleted: seller.onboardingCompleted,
      onboardingStep: seller.onboardingStep,
      mobileStep: mobileStep,
      businessInfo: seller.businessInfo,
      kyc: seller.kyc,
      bankDetails: seller.bankDetails,
      selectedServiceCategories: seller.selectedServiceCategories,
      store: seller.store,
      nationIdentityNumber: seller.nationIdentityNumber,
      agreement: seller.agreement,
    },
  });
}

/**
 * POST /mobileapi/service-seller/onboarding
 */
export async function POST(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_SERVICE);
  if (!auth.success) return auth.errorResponse;

  const { seller, user } = auth;
  const contentType = request.headers.get("content-type") ?? "";

  let mobileStep: number = 0;
  let formData: FormData | null = null;
  let jsonBody: any = null;

  if (contentType.includes("multipart/form-data")) {
    formData = await request.formData();
    mobileStep = parseInt(formData.get("step") as string, 10);
  } else {
    jsonBody = await request.json();
    mobileStep = jsonBody.step;
  }

  try {
    if (mobileStep === 1) {
        // Step 1: Business Information
        const haveGst = formData ? (formData.get("haveGst") === "true") : !!jsonBody.data.haveGst;
        const businessData = formData ? {
            businessName: formData.get("businessName") as string,
            businessType: formData.get("businessType") as string,
            businessRegNumber: formData.get("businessRegNumber") as string,
            taxIdNumber: haveGst ? (formData.get("taxIdNumber") as string) : null,
            street: formData.get("street") as string,
            city: formData.get("city") as string,
            district: formData.get("district") as string,
            postalCode: formData.get("postalCode") as string,
            natureOfBusiness: formData.get("natureOfBusiness") as string,
            haveGst,
            gstInvNo: haveGst ? (formData.get("gstInvNo") as string) : null,
            gstCustomerName: haveGst ? (formData.get("gstCustomerName") as string) : null,
        } : {
            ...jsonBody.data,
            haveGst,
            taxIdNumber: haveGst ? jsonBody.data.taxIdNumber : null,
            gstInvNo: haveGst ? jsonBody.data.gstInvNo : null,
            gstCustomerName: haveGst ? jsonBody.data.gstCustomerName : null,
        };

        const nationIdentityNumber = formData ? (formData.get("nationIdentityNumber") as string) : jsonBody.data.nationIdentityNumber;

        if (formData) {
            const profileFile = formData.get("profileImage") as File | null;
            if (profileFile && profileFile.size > 0) {
                const url = await uploadPublicFile({
                    folder: "profile",
                    ext: path.extname(profileFile.name) || ".jpg",
                    contentType: profileFile.type || "image/jpeg",
                    buffer: Buffer.from(await profileFile.arrayBuffer()),
                    prefix: "profile",
                });
                await prisma.user.update({ where: { id: user.id }, data: { image: url } });
            }
            const certFile = formData.get("busRegCert") as File | null;
            if (certFile && certFile.size > 0) {
                const url = await uploadPublicFile({
                    folder: "onboarding/business",
                    ext: path.extname(certFile.name) || ".pdf",
                    contentType: certFile.type || "application/pdf",
                    buffer: Buffer.from(await certFile.arrayBuffer()),
                    prefix: "bus-reg",
                });
                (businessData as any).busRegCertUrl = url;
            }
        }

        await prisma.seller.update({
            where: { id: seller.id },
            data: {
                nationIdentityNumber,
                onboardingStep: Math.max(seller.onboardingStep, 3),
                businessInfo: {
                    upsert: {
                        create: { ...businessData as any },
                        update: { ...businessData as any },
                    },
                },
            },
        });
    }

    else if (mobileStep === 2) {
        // Step 2: KYC
        const kycData: any = formData ? {
            idType: formData.get("idType") as string,
            idNumber: formData.get("idNumber") as string,
        } : { ...jsonBody.data };

        if (formData) {
            for (const f of ["idFront", "idBack", "selfie"]) {
                const file = formData.get(f) as File | null;
                if (file && file.size > 0) {
                    kycData[`${f}Url`] = await uploadPublicFile({
                        folder: "onboarding/kyc",
                        ext: path.extname(file.name) || ".jpg",
                        contentType: file.type || "image/jpeg",
                        buffer: Buffer.from(await file.arrayBuffer()),
                        prefix: f,
                    });
                }
            }
        }

        await prisma.seller.update({
            where: { id: seller.id },
            data: {
                onboardingStep: Math.max(seller.onboardingStep, 4),
                kyc: { upsert: { create: { ...kycData }, update: { ...kycData } } },
            },
        });
    }

    else if (mobileStep === 3) {
        // Step 3: Bank
        const bankData: any = formData ? {
            bankName: formData.get("bankName") as string,
            accountHolderName: formData.get("accountHolderName") as string,
            accountNumber: formData.get("accountNumber") as string,
            branchName: formData.get("branchName") as string,
            preferredPayoutMethod: formData.get("preferredPayoutMethod") as string,
            mobileMoneyOption: formData.get("mobileMoneyOption") as string,
        } : { ...jsonBody.data };

        if (formData) {
            const passbook = formData.get("bankPassbook") as File | null;
            if (passbook && passbook.size > 0) {
                bankData.passbookUrl = await uploadPublicFile({
                    folder: "onboarding/bank",
                    ext: path.extname(passbook.name) || ".jpg",
                    contentType: passbook.type || "image/jpeg",
                    buffer: Buffer.from(await passbook.arrayBuffer()),
                    prefix: "bank-passbook",
                });
            }
        }

        await prisma.seller.update({
            where: { id: seller.id },
            data: {
                onboardingStep: Math.max(seller.onboardingStep, 5),
                bankDetails: { upsert: { create: { ...bankData }, update: { ...bankData } } },
            },
        });
    }

    else if (mobileStep === 4) {
        // Step 4: Service Profile (Category Selection & Store Setup)
        const categoryIds = formData ? formData.getAll("categoryIds") : jsonBody.data.categoryIds;
        const storeData: any = formData ? {
            name: formData.get("storeName") as string,
            description: formData.get("description") as string,
        } : { ...jsonBody.data.store };

        if (formData) {
            const logoFile = formData.get("storeLogo") as File | null;
            const bannerFile = formData.get("storeBanner") as File | null;

            if (logoFile && logoFile.size > 0) {
                storeData.logo = await uploadPublicFile({
                    folder: "onboarding/store",
                    ext: path.extname(logoFile.name) || ".jpg",
                    contentType: logoFile.type || "image/jpeg",
                    buffer: Buffer.from(await logoFile.arrayBuffer()),
                    prefix: "store-logo",
                });
            }
            if (bannerFile && bannerFile.size > 0) {
                storeData.banner = await uploadPublicFile({
                    folder: "onboarding/store",
                    ext: path.extname(bannerFile.name) || ".jpg",
                    contentType: bannerFile.type || "image/jpeg",
                    buffer: Buffer.from(await bannerFile.arrayBuffer()),
                    prefix: "store-banner",
                });
            }
            
            const latRaw = formData.get("storeLat") as string | null;
            const lngRaw = formData.get("storeLng") as string | null;
            const addressRaw = formData.get("storeAddress") as string | null;
            
            if (addressRaw) storeData.address = addressRaw;

            if (latRaw && lngRaw) {
                const lat = parseFloat(latRaw);
                const lng = parseFloat(lngRaw);
                if (!isNaN(lat) && !isNaN(lng)) {
                    storeData.lat = lat;
                    storeData.lng = lng;
                }
            }
        } else {
             if(jsonBody.data.storeLat != undefined && jsonBody.data.storeLng != undefined){
                storeData.lat = parseFloat(jsonBody.data.storeLat)
                storeData.lng = parseFloat(jsonBody.data.storeLng)
             }
             if(jsonBody.data.storeAddress != undefined){
                storeData.address = String(jsonBody.data.storeAddress)
             }
        }

        await prisma.seller.update({
            where: { id: seller.id },
            data: {
                onboardingStep: Math.max(seller.onboardingStep, 6),
                selectedServiceCategories: {
                    set: categoryIds.map((id: string) => ({ id })),
                },
                store: {
                    upsert: {
                        create: { ...storeData },
                        update: { ...storeData },
                    },
                },
            },
        });
    }

    else if (mobileStep === 5) {
        // Step 5: Agreement
        const agreementData = formData ? {
            agreedToTerms: formData.get("agreedToTerms") === "true",
            agreedToCommission: formData.get("agreedToCommission") === "true",
            agreedToReturnPolicy: formData.get("agreedToReturnPolicy") === "true",
            agreedToPrivacy: formData.get("agreedToPrivacy") === "true",
        } : { ...jsonBody.data };

        await prisma.seller.update({
            where: { id: seller.id },
            data: {
                onboardingCompleted: true,
                onboardingStep: 6,
                agreement: { upsert: { create: { ...agreementData }, update: { ...agreementData } } },
            },
        });
    }

    return NextResponse.json({
        success: true,
        message: `Step ${mobileStep} saved successfully`,
        data: {
            nextStep: mobileStep < 5 ? mobileStep + 1 : null,
            onboardingCompleted: (mobileStep === 5),
        },
    });

  } catch (error: any) {
    console.error("Mobile service seller onboarding error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save onboarding step" },
      { status: 500 }
    );
  }
}

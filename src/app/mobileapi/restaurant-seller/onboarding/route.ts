import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileHotelRestaurantAuth } from "@/lib/mobile-hotel-restaurant-auth-server";
import { uploadPublicFile } from "@/lib/upload-public-file";
import { UserRole } from "@prisma/client";
import path from "path";
import { activateRestaurantFreePlan } from "@/lib/subscriptions";

/**
 * GET /mobileapi/restaurant-seller/onboarding
 */
export async function GET(request: NextRequest) {
    const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_RESTAURANT);
    if (!auth.success) return auth.errorResponse;

    const { seller } = auth;
    const mobileStep = Math.max(2, seller.onboardingStep);

    return NextResponse.json({
        success: true,
        data: {
            user: auth.user,
            onboardingCompleted: seller.onboardingCompleted,
            onboardingStep: seller.onboardingStep,
            status: seller.status, // PENDING, APPROVED, CORRECTION_NEEDED, REJECTED
            adminFeedback: seller.adminFeedback,
            isApproved: seller.isApproved,
            isSuspended: seller.isSuspended,
            mobileStep: seller.status === "CORRECTION_NEEDED" ? 2 : mobileStep,
            businessInfo: seller.businessInfo,
            kyc: seller.kyc,
            bankDetails: seller.bankDetails,
            agreement: seller.agreement,
            logo: seller.logo,
            banner: seller.banner,
            mainPhoto: seller.mainPhoto,
            estimateRestaurantCount: seller.estimateRestaurantCount,
            primaryCuisine: seller.primaryCuisine,
            serviceTypes: seller.serviceTypes,
        },
    });
}

/**
 * POST /mobileapi/restaurant-seller/onboarding
 */
export async function POST(request: NextRequest) {
    const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_RESTAURANT);
    if (!auth.success) return auth.errorResponse;

    const { seller, user } = auth;
    const contentType = request.headers.get("content-type") ?? "";

    let step: number = 0;
    let formData: FormData | null = null;
    let jsonBody: any = null;

    if (contentType.includes("multipart/form-data")) {
        formData = await request.formData();
        const stepVal = formData.get("step") || formData.get("mobileStep");
        step = parseInt(stepVal as string, 10);
    } else {
        jsonBody = await request.json();
        step = jsonBody.step || jsonBody.mobileStep;
    }

    try {
        if (step === 2) {
            // Step 2: Business Information
            const haveGst = formData ? (formData.get("haveGst") === "true") : !!jsonBody?.data?.haveGst;
            const businessData = {
                businessName: (formData?.get("businessName") as string) || jsonBody?.data?.businessName,
                businessType: (formData?.get("businessType") as string) || jsonBody?.data?.businessType,
                businessRegNumber: (formData?.get("businessRegNumber") as string) || jsonBody?.data?.businessRegNumber,
                taxIdNumber: (formData?.get("taxIdNumber") as string) || jsonBody?.data?.taxIdNumber,
                landmark: (formData?.get("landmark") as string) || jsonBody?.data?.landmark,
                managerName: (formData?.get("managerName") as string) || jsonBody?.data?.managerName,
                pocContact: (formData?.get("pocContact") as string) || jsonBody?.data?.pocContact,
                street: (formData?.get("street") as string) || jsonBody?.data?.street || null,
                city: (formData?.get("city") as string) || jsonBody?.data?.city,
                district: (formData?.get("district") as string) || jsonBody?.data?.district || null,
                state: (formData?.get("state") as string) || jsonBody?.data?.state,
                haveGst,
                gstInvNo: haveGst ? ((formData?.get("gstInvNo") as string) || jsonBody?.data?.gstInvNo) : null,
                gstCustomerName: haveGst ? ((formData?.get("gstCustomerName") as string) || jsonBody?.data?.gstCustomerName) : null,
            };

            if (formData) {
                const profileImageFile = formData.get("profileImage") as File | null;
                if (profileImageFile && profileImageFile.size > 0) {
                    const imageUrl = await uploadPublicFile({
                        folder: "profile",
                        ext: path.extname(profileImageFile.name) || ".jpg",
                        contentType: profileImageFile.type || "image/jpeg",
                        buffer: Buffer.from(await profileImageFile.arrayBuffer()),
                        prefix: "profile",
                    });
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { image: imageUrl },
                    });
                }
            }

            let busRegCertUrl = seller.businessInfo?.busRegCertUrl;
            let cityCouncilCertUrl = seller.businessInfo?.cityCouncilCertUrl;
            let gstTinCertUrl = seller.businessInfo?.gstTinCertUrl;
            let addressProofUrl = seller.businessInfo?.addressProofUrl;

            if (formData) {
                const file = formData.get("busRegCert") as File | null;
                if (file && file.size > 0) {
                    busRegCertUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/business",
                        ext: path.extname(file.name) || ".pdf",
                        contentType: file.type || "application/pdf",
                        buffer: Buffer.from(await file.arrayBuffer()),
                        prefix: "restaurant-bus-reg",
                    });
                }
                const fileCC = formData.get("cityCouncilCert") as File | null;
                if (fileCC && fileCC.size > 0) {
                    cityCouncilCertUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/business",
                        ext: path.extname(fileCC.name) || ".pdf",
                        contentType: fileCC.type || "application/pdf",
                        buffer: Buffer.from(await fileCC.arrayBuffer()),
                        prefix: "restaurant-city-council",
                    });
                }
                const fileGST = formData.get("gstTinCert") as File | null;
                if (fileGST && fileGST.size > 0) {
                    gstTinCertUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/business",
                        ext: path.extname(fileGST.name) || ".pdf",
                        contentType: fileGST.type || "application/pdf",
                        buffer: Buffer.from(await fileGST.arrayBuffer()),
                        prefix: "restaurant-gst-tin",
                    });
                }
                const fileAP = formData.get("addressProof") as File | null;
                if (fileAP && fileAP.size > 0) {
                    addressProofUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/business",
                        ext: path.extname(fileAP.name) || ".pdf",
                        contentType: fileAP.type || "application/pdf",
                        buffer: Buffer.from(await fileAP.arrayBuffer()),
                        prefix: "restaurant-address-proof",
                    });
                }
            } else if (jsonBody?.data) {
                if (jsonBody.data.cityCouncilCertUrl) cityCouncilCertUrl = jsonBody.data.cityCouncilCertUrl;
                if (jsonBody.data.gstTinCertUrl) gstTinCertUrl = jsonBody.data.gstTinCertUrl;
                if (jsonBody.data.addressProofUrl) addressProofUrl = jsonBody.data.addressProofUrl;
            }

            await prisma.restaurantBusinessInfo.upsert({
                where: { restaurantSellerId: seller.id },
                update: { ...businessData, busRegCertUrl, cityCouncilCertUrl, gstTinCertUrl, addressProofUrl },
                create: { ...businessData, busRegCertUrl, cityCouncilCertUrl, gstTinCertUrl, addressProofUrl, restaurantSellerId: seller.id },
            });

            await prisma.restaurantSeller.update({
                where: { id: seller.id },
                data: { onboardingStep: Math.max(seller.onboardingStep, 3) },
            });
        }

        else if (step === 3) {
            // Step 3: KYC & Food License
            const kycData = {
                idType: (formData?.get("idType") as string) || jsonBody?.data?.idType,
                idNumber: (formData?.get("idNumber") as string) || jsonBody?.data?.idNumber,
                foodLicenseNumber: (formData?.get("foodLicenseNumber") as string) || jsonBody?.data?.foodLicenseNumber,
            };

            let idFrontUrl = seller.kyc?.idFrontUrl;
            let idBackUrl = seller.kyc?.idBackUrl;
            let selfieUrl = seller.kyc?.selfieUrl;
            let foodLicenseUrl = seller.kyc?.foodLicenseUrl;

            if (formData) {
                const front = formData.get("idFront") as File | null;
                const back = formData.get("idBack") as File | null;
                const selfie = formData.get("selfie") as File | null;
                const license = formData.get("foodLicense") as File | null;

                if (front && front.size > 0) {
                    idFrontUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/kyc",
                        ext: path.extname(front.name) || ".jpg",
                        contentType: front.type || "image/jpeg",
                        buffer: Buffer.from(await front.arrayBuffer()),
                        prefix: "restaurant-id-front",
                    });
                }
                if (back && back.size > 0) {
                    idBackUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/kyc",
                        ext: path.extname(back.name) || ".jpg",
                        contentType: back.type || "image/jpeg",
                        buffer: Buffer.from(await back.arrayBuffer()),
                        prefix: "restaurant-id-back",
                    });
                }
                if (selfie && selfie.size > 0) {
                    selfieUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/kyc",
                        ext: path.extname(selfie.name) || ".jpg",
                        contentType: selfie.type || "image/jpeg",
                        buffer: Buffer.from(await selfie.arrayBuffer()),
                        prefix: "restaurant-selfie",
                    });
                }
                if (license && license.size > 0) {
                    foodLicenseUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/kyc",
                        ext: path.extname(license.name) || ".pdf",
                        contentType: license.type || "application/pdf",
                        buffer: Buffer.from(await license.arrayBuffer()),
                        prefix: "restaurant-food-license",
                    });
                }
            }

            await prisma.restaurantKYC.upsert({
                where: { restaurantSellerId: seller.id },
                update: { ...kycData, idFrontUrl, idBackUrl, selfieUrl, foodLicenseUrl },
                create: { ...kycData, idFrontUrl, idBackUrl, selfieUrl, foodLicenseUrl, restaurantSellerId: seller.id },
            });

            await prisma.restaurantSeller.update({
                where: { id: seller.id },
                data: { onboardingStep: Math.max(seller.onboardingStep, 4) },
            });
        }

        else if (step === 4) {
            // Step 4: Outlet Setup
            const countVal = formData ? formData.get("estimateRestaurantCount") : jsonBody?.data?.estimateRestaurantCount;
            const estimateRestaurantCount = parseInt(countVal as string, 10) || 0;
            const cuisines = formData ? formData.getAll("cuisines") : (jsonBody?.data?.cuisines || []);
            const services = formData ? formData.getAll("services") : (jsonBody?.data?.services || []);

            let logoUrl = seller.logo;
            let bannerUrl = seller.banner;
            let mainPhotoUrl = seller.mainPhoto;

            if (formData) {
                const logo = formData.get("logo") as File | null;
                const banner = formData.get("banner") as File | null;
                const photo = formData.get("mainPhoto") as File | null;

                if (logo && logo.size > 0) {
                    logoUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/property",
                        ext: path.extname(logo.name) || ".jpg",
                        contentType: logo.type || "image/jpeg",
                        buffer: Buffer.from(await logo.arrayBuffer()),
                        prefix: "restaurant-logo",
                    });
                }
                if (banner && banner.size > 0) {
                    bannerUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/property",
                        ext: path.extname(banner.name) || ".jpg",
                        contentType: banner.type || "image/jpeg",
                        buffer: Buffer.from(await banner.arrayBuffer()),
                        prefix: "restaurant-banner",
                    });
                }
                if (photo && photo.size > 0) {
                    mainPhotoUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/property",
                        ext: path.extname(photo.name) || ".jpg",
                        contentType: photo.type || "image/jpeg",
                        buffer: Buffer.from(await photo.arrayBuffer()),
                        prefix: "restaurant-main-photo",
                    });
                }
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
                    onboardingStep: Math.max(seller.onboardingStep, 5),
                },
            });
        }

        else if (step === 5) {
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
            };

            let passbookUrl = seller.bankDetails?.passbookUrl;
            let bankLetterUrl = seller.bankDetails?.bankLetterUrl;
            if (formData) {
                const file = formData.get("passbook") as File | null;
                if (file && file.size > 0) {
                    passbookUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/bank",
                        ext: path.extname(file.name) || ".jpg",
                        contentType: file.type || "image/jpeg",
                        buffer: Buffer.from(await file.arrayBuffer()),
                        prefix: "restaurant-bank-passbook",
                    });
                }
                const fileBL = formData.get("bankLetter") as File | null;
                if (fileBL && fileBL.size > 0) {
                    bankLetterUrl = await uploadPublicFile({
                        folder: "restaurant-onboarding/bank",
                        ext: path.extname(fileBL.name) || ".pdf",
                        contentType: fileBL.type || "application/pdf",
                        buffer: Buffer.from(await fileBL.arrayBuffer()),
                        prefix: "restaurant-bank-letter",
                    });
                }
            }

            await prisma.restaurantBankDetails.upsert({
                where: { restaurantSellerId: seller.id },
                update: { ...bankData, passbookUrl, bankLetterUrl },
                create: { ...bankData, passbookUrl, bankLetterUrl, restaurantSellerId: seller.id },
            });

            await prisma.restaurantSeller.update({
                where: { id: seller.id },
                data: { onboardingStep: Math.max(seller.onboardingStep, 6) },
            });
        }

        else if (step === 6) {
            // Step 6: Agreement
            const agreementData = jsonBody?.data || {
                agreedToTerms: formData?.get("agreedToTerms") === "true" || formData?.get("agreedToTerms") === "on",
                agreedToCommission: formData?.get("agreedToCommission") === "true" || formData?.get("agreedToCommission") === "on",
                agreedToPrivacy: formData?.get("agreedToPrivacy") === "true" || formData?.get("agreedToPrivacy") === "on",
            };

            await prisma.restaurantAgreement.upsert({
                where: { restaurantSellerId: seller.id },
                update: agreementData,
                create: { ...agreementData, restaurantSellerId: seller.id },
            });

            await prisma.restaurantSeller.update({
                where: { id: seller.id },
                data: { 
                    onboardingCompleted: true, 
                    onboardingStep: 7,
                    status: "PENDING",
                    adminFeedback: null,
                },
            });

            await activateRestaurantFreePlan(seller.id);

            return NextResponse.json({
                success: true,
                message: "Registration completed successfully",
                data: {
                    nextStep: null,
                    onboardingCompleted: true,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: `Step ${step} saved successfully`,
            data: {
                nextStep: step < 6 ? step + 1 : null,
                onboardingCompleted: false,
            },
        });

    } catch (error: any) {
        console.error("Mobile restaurant seller onboarding error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to save onboarding step" },
            { status: 500 }
        );
    }
}

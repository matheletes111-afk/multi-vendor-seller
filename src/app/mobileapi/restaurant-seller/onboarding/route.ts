import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileHotelRestaurantAuth } from "@/lib/mobile-hotel-restaurant-auth-server";
import { uploadPublicFile } from "@/lib/upload-public-file";
import { UserRole } from "@prisma/client";
import path from "path";
import { activateRestaurantFreePlan } from "@/lib/subscriptions";
import { HEAR_ABOUT_US_OPTIONS, formatHearAboutUs } from "@/lib/onboarding-constants";
import { evaluateSellerDocuments } from "@/lib/seller-approval-validation";
import { validateAndFormatPaymentDetails } from "@/lib/payment-details-helper";

/**
 * GET /mobileapi/restaurant-seller/onboarding
 */
export async function GET(request: NextRequest) {
    const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_RESTAURANT);
    if (!auth.success) return auth.errorResponse;

    const { seller } = auth;
    const mobileStep = Math.max(2, seller.onboardingStep);
    const sectionNames = ["business", "kyc", "restaurant", "bank", "agreement"];
    const currentStep1Based = seller.status === "CORRECTION_NEEDED" ? 1 : Math.max(1, seller.onboardingStep - 1);
    const currentSection = sectionNames[currentStep1Based - 1] || "business";

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
            currentStep: seller.status === "CORRECTION_NEEDED" ? 1 : Math.max(1, seller.onboardingStep - 1),
            step: seller.onboardingStep,
            section: currentSection,
            stepName: currentSection,
            businessInfo: seller.businessInfo,
            kyc: seller.kyc,
            bankDetails: seller.bankDetails,
            agreement: seller.agreement ? {
                ...seller.agreement,
                agreedToReturnPolicy: false, // Not stored in DB for restaurant; mobile resets this to false on each session
            } : null,
            logo: seller.logo,
            banner: seller.banner,
            mainPhoto: seller.mainPhoto,
            estimateRestaurantCount: seller.estimateRestaurantCount,
            primaryCuisine: seller.primaryCuisine,
            serviceTypes: seller.serviceTypes,
            hearAboutUsOptions: HEAR_ABOUT_US_OPTIONS,
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

    let formData: FormData | null = null;
    let jsonBody: any = null;

    if (contentType.includes("multipart/form-data")) {
        formData = await request.formData();
    } else {
        jsonBody = await request.json();
    }

    const explicit1Based = formData ? (formData.get("mobileStep") || formData.get("currentStep")) : (jsonBody?.mobileStep || jsonBody?.currentStep);
    const rawStepVal = formData ? (formData.get("step") || formData.get("onboardingStep") || explicit1Based) : (jsonBody?.step || jsonBody?.onboardingStep || explicit1Based);

    const getField = (name: string): any => {
        if (formData) return formData.get(name);
        return jsonBody?.data?.[name] ?? jsonBody?.[name];
    };
    const hasField = (name: string): boolean => {
        const val = getField(name);
        return val !== undefined && val !== null && val !== "";
    };
    const hasAny = (...names: string[]): boolean => names.some(n => hasField(n));

    // Determine step: signature detection > section > explicit 1-based > fallback number
    let step = 0;
    const section = (getField("section") || getField("stepName") || "").toString().toLowerCase();

    if (section === "business" || section === "businessinfo") step = 2;
    else if (section === "kyc" || section === "identity") step = 3;
    else if (section === "outlet" || section === "restaurant" || section === "cuisines") step = 4;
    else if (section === "bank" || section === "bankdetails" || section === "payment") step = 5;
    else if (section === "agreement" || section === "legal") step = 6;

    // 1. Signature detection for Bank / Payment Details (Step 5)
    if (!step && (
        hasAny("paymentOption", "mobileMoneyOption", "bankName", "accountHolderName", "accountNumber", "bbanNumber", "branchName", "bankAddress", "bankPassbook", "passbook", "bankLetter", "preferredPayoutMethod") ||
        (hasField("mobileNumber") && !hasField("businessName") && !hasField("managerName") && !hasField("restaurantName")) ||
        (hasField("agentNumber") && !hasField("businessName"))
    )) {
        step = 5;
    }

    // 2. Signature detection for Agreement (Step 6)
    if (!step && hasAny("agreedToTerms", "agreedToCommission", "agreedToReturnPolicy", "agreedToPrivacy", "hearAboutUs", "hearAboutUsOther", "otherHearAboutUs")) {
        step = 6;
    }

    // 3. Signature detection for Outlet Setup (Step 4)
    if (!step && (hasAny("estimateRestaurantCount", "primaryCuisine", "cuisines", "serviceTypes", "services", "mainPhoto", "logo", "banner"))) {
        step = 4;
    }

    // 4. Signature detection for KYC / Identity (Step 3)
    if (!step && hasAny("idType", "idNumber", "idFront", "idBack", "selfie", "nationIdentityNumber")) {
        step = 3;
    }

    // 5. Signature detection for Business Info (Step 2)
    if (!step && hasAny("businessName", "businessType", "businessRegNumber", "busRegCert", "taxIdNumber", "managerName", "pocContact", "haveGst", "cityCouncilCert", "addressProof", "foodLicense", "foodLicenseUrl")) {
        step = 2;
    }

    // Fallback 1: Explicit 1-based parameter (mobileStep or currentStep where 1=Business, 2=KYC, 3=Restaurant, 4=Bank, 5=Agreement)
    if (!step && explicit1Based !== undefined && explicit1Based !== null) {
        const parsed = parseInt(explicit1Based as string, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
            step = parsed + 1; // Map 1..5 to 2..6
        }
    }

    // Fallback 2: General step / onboardingStep number resolution
    if (!step && rawStepVal !== undefined && rawStepVal !== null) {
        const parsed = parseInt(rawStepVal as string, 10);
        if (!isNaN(parsed)) {
            if (parsed === 1) step = 2; // 1-based Business
            else if (parsed === 6) step = 6; // 2-based Agreement
            else if (parsed === seller.onboardingStep) step = parsed; // 2-based DB step match
            else if (parsed === seller.onboardingStep - 1) step = parsed + 1; // 1-based mobile step match
            else if (parsed >= 2 && parsed <= 6) step = parsed; // default 2-based step
            else if (parsed > 6) step = 6;
        }
    }

    if (step === 0) {
        return NextResponse.json(
            { success: false, error: "Invalid onboarding step or missing step data." },
            { status: 400 }
        );
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
                latitude: (() => { const v = formData ? formData.get("latitude") : jsonBody?.data?.latitude; return v != null && !isNaN(Number(v)) ? Number(v) : null })(),
                longitude: (() => { const v = formData ? formData.get("longitude") : jsonBody?.data?.longitude; return v != null && !isNaN(Number(v)) ? Number(v) : null })(),
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
                if (jsonBody.data.busRegCertUrl) busRegCertUrl = jsonBody.data.busRegCertUrl;
                if (jsonBody.data.cityCouncilCertUrl) cityCouncilCertUrl = jsonBody.data.cityCouncilCertUrl;
                if (jsonBody.data.gstTinCertUrl) gstTinCertUrl = jsonBody.data.gstTinCertUrl;
                if (jsonBody.data.addressProofUrl) addressProofUrl = jsonBody.data.addressProofUrl;
            }

            if (!busRegCertUrl) {
                return NextResponse.json({ success: false, error: "Business Registration Certificate is mandatory." }, { status: 400 });
            }
            if (haveGst && !gstTinCertUrl) {
                return NextResponse.json({ success: false, error: "GST TIN Certificate is mandatory when selling with GST." }, { status: 400 });
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
            } else if (jsonBody?.data) {
                if (jsonBody.data.idFrontUrl) idFrontUrl = jsonBody.data.idFrontUrl;
                if (jsonBody.data.idBackUrl) idBackUrl = jsonBody.data.idBackUrl;
                if (jsonBody.data.selfieUrl) selfieUrl = jsonBody.data.selfieUrl;
                if (jsonBody.data.foodLicenseUrl) foodLicenseUrl = jsonBody.data.foodLicenseUrl;
            }

            if (!idFrontUrl) {
                return NextResponse.json({ success: false, error: "National ID / Passport Front document is mandatory." }, { status: 400 });
            }
            if (!idBackUrl) {
                return NextResponse.json({ success: false, error: "National ID / Passport Back document is mandatory." }, { status: 400 });
            }
            if (!foodLicenseUrl) {
                return NextResponse.json({ success: false, error: "Food Hygiene / Food License document is mandatory." }, { status: 400 });
            }
            if (!kycData.foodLicenseNumber) {
                return NextResponse.json({ success: false, error: "Food License Number is mandatory." }, { status: 400 });
            }
            if (!selfieUrl) {
                return NextResponse.json({ success: false, error: "Selfie / Face Verification is mandatory." }, { status: 400 });
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
            } else if (jsonBody?.data) {
                if (jsonBody.data.logo) logoUrl = jsonBody.data.logo;
                if (jsonBody.data.banner) bannerUrl = jsonBody.data.banner;
                if (jsonBody.data.mainPhoto) mainPhotoUrl = jsonBody.data.mainPhoto;
            }

            if (!logoUrl || !mainPhotoUrl) {
                return NextResponse.json({ success: false, error: "Restaurant Logo and Main Restaurant Photo are mandatory." }, { status: 400 });
            }

            if (!cuisines || cuisines.length === 0) {
                return NextResponse.json({ success: false, error: "Please select at least one primary cuisine." }, { status: 400 });
            }

            if (!services || services.length === 0) {
                return NextResponse.json({ success: false, error: "Please select at least one service type." }, { status: 400 });
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
            // Step 5: Bank / Payout Details
            let passbookUrl = seller.bankDetails?.passbookUrl;
            let bankLetterUrl = seller.bankDetails?.bankLetterUrl;
            if (formData) {
                const file = (formData.get("passbook") || formData.get("bankPassbook")) as File | null;
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
            } else if (jsonBody?.data) {
                if (jsonBody.data.passbookUrl) passbookUrl = jsonBody.data.passbookUrl;
                if (jsonBody.data.bankLetterUrl) bankLetterUrl = jsonBody.data.bankLetterUrl;
            }

            const rawInput = formData ? {
                paymentOption: formData.get("paymentOption") as string,
                preferredPayoutMethod: formData.get("preferredPayoutMethod") as string,
                mobileMoneyOption: formData.get("mobileMoneyOption") as string,
                mobileNumber: formData.get("mobileNumber") as string,
                agentNumber: formData.get("agentNumber") as string,
                bankName: formData.get("bankName") as string,
                bankAddress: formData.get("bankAddress") as string,
                accountHolderName: formData.get("accountHolderName") as string,
                accountNumber: formData.get("accountNumber") as string,
                bbanNumber: formData.get("bbanNumber") as string,
                branchName: formData.get("branchName") as string,
                passbookUrl,
                bankLetterUrl,
            } : {
                ...jsonBody?.data,
                passbookUrl,
                bankLetterUrl,
            };

            const { data: bankData, error: valErr } = validateAndFormatPaymentDetails(rawInput, { requireFields: true });
            if (valErr) {
                return NextResponse.json({ success: false, error: valErr }, { status: 400 });
            }

            await prisma.restaurantBankDetails.upsert({
                where: { restaurantSellerId: seller.id },
                update: bankData as any,
                create: { ...bankData, restaurantSellerId: seller.id } as any,
            });

            await prisma.restaurantSeller.update({
                where: { id: seller.id },
                data: { onboardingStep: Math.max(seller.onboardingStep, 6) },
            });
        }

        else if (step === 6) {
            // Step 6: Agreement
            const rawHearAboutUs = formData ? (formData.get("hearAboutUs") as string) : ((jsonBody?.data?.hearAboutUs ?? jsonBody?.hearAboutUs) as string);
            const rawHearAboutUsOther = formData ? (formData.get("hearAboutUsOther") as string) : ((jsonBody?.data?.hearAboutUsOther ?? jsonBody?.hearAboutUsOther) as string);

            if (!rawHearAboutUs || !rawHearAboutUs.trim()) {
                return NextResponse.json({ success: false, error: "Please select how you heard about us." }, { status: 400 });
            }
            if (rawHearAboutUs.trim() === "Other" && (!rawHearAboutUsOther || !rawHearAboutUsOther.trim())) {
                return NextResponse.json({ success: false, error: "Please specify where you heard about our platform." }, { status: 400 });
            }

            const agreementData = formData ? {
                agreedToTerms: formData.get("agreedToTerms") === "true" || formData.get("agreedToTerms") === "on",
                agreedToCommission: formData.get("agreedToCommission") === "true" || formData.get("agreedToCommission") === "on",
                agreedToPrivacy: formData.get("agreedToPrivacy") === "true" || formData.get("agreedToPrivacy") === "on",
                hearAboutUs: formatHearAboutUs(rawHearAboutUs, rawHearAboutUsOther),
            } : {
                agreedToTerms: !!jsonBody?.data?.agreedToTerms,
                agreedToCommission: !!jsonBody?.data?.agreedToCommission,
                agreedToPrivacy: !!jsonBody?.data?.agreedToPrivacy,
                hearAboutUs: formatHearAboutUs(rawHearAboutUs, rawHearAboutUsOther),
            };

            await prisma.restaurantAgreement.upsert({
                where: { restaurantSellerId: seller.id },
                update: agreementData,
                create: { ...agreementData, restaurantSellerId: seller.id },
            });

            // Strict validation before marking complete
            const verifySeller = await prisma.restaurantSeller.findUnique({
                where: { id: seller.id },
                include: { businessInfo: true, kyc: true, bankDetails: true, agreement: true, user: true }
            });
            const docEval = evaluateSellerDocuments(verifySeller, "RESTAURANT");
            if (!docEval.isComplete) {
                return NextResponse.json({
                    success: false,
                    error: `Cannot complete onboarding: Missing required documents: ${docEval.missingDocuments.join(", ")}`,
                }, { status: 400 });
            }

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

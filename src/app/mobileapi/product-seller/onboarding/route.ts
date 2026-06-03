import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileAuth } from "@/lib/mobile-auth-server";
import { uploadPublicFile } from "@/lib/upload-public-file";
import { UserRole } from "@prisma/client";
import path from "path";
import { generateSlug } from "@/lib/utils";

/**
 * GET /mobileapi/product-seller/onboarding
 * Fetch current onboarding status and existing data.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT);
  if (!auth.success) return auth.errorResponse;

  const { seller } = auth;

  // Map DB step to mobile step (1-5)
  // DB Step 1-2 -> Mobile 1, DB Step 3 -> Mobile 2, etc.
  const mobileStep = Math.max(1, seller.onboardingStep - 1);

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
      mobileStep: seller.status === "CORRECTION_NEEDED" ? 1 : mobileStep,
      businessInfo: seller.businessInfo,
      kyc: seller.kyc,
      bankDetails: seller.bankDetails,
      store: seller.store,
      selectedCategories: seller.selectedCategories,
      nationIdentityNumber: seller.nationIdentityNumber,
      agreement: seller.agreement,
    },
  });
}

/**
 * POST /mobileapi/product-seller/onboarding
 * Submit data for a specific onboarding step.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT);
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

  // Map mobile step back to database step
  const dbStep = mobileStep + 1;

  try {
    if (mobileStep === 1) {
      // Step 1: Business Information
      const haveGst = formData ? (formData.get("haveGst") === "true") : !!jsonBody.data.haveGst;

      const businessData = formData ? {
        businessName: formData.get("businessName") as string,
        businessType: formData.get("businessType") as string,
        businessRegNumber: formData.get("businessRegNumber") as string,
        taxIdNumber: formData.get("taxIdNumber") as string,
        street: formData.get("street") as string,
        city: formData.get("city") as string,
        district: formData.get("district") as string,
        postalCode: formData.get("postalCode") as string,
        natureOfBusiness: formData.get("natureOfBusiness") as string,
        haveGst,
        gstInvNo: haveGst ? (formData.get("gstInvNo") as string) : null,
        gstCustomerName: haveGst ? (formData.get("gstCustomerName") as string) : null,
        busRegCertUrl: seller.businessInfo?.busRegCertUrl || null,
        cityCouncilCertUrl: seller.businessInfo?.cityCouncilCertUrl || null,
        gstTinCertUrl: seller.businessInfo?.gstTinCertUrl || null,
        addressProofUrl: seller.businessInfo?.addressProofUrl || null,
      } : {
        ...jsonBody.data,
        haveGst,
        taxIdNumber: jsonBody.data.taxIdNumber,
        gstInvNo: haveGst ? jsonBody.data.gstInvNo : null,
        gstCustomerName: haveGst ? jsonBody.data.gstCustomerName : null,
      };

      // Handle Profile Image if present
      if (formData) {
        const profileImage = formData.get("profileImage") as File | null;
        if (profileImage && profileImage.size > 0) {
          const url = await uploadPublicFile({
            folder: "profile",
            ext: path.extname(profileImage.name) || ".jpg",
            contentType: profileImage.type || "image/jpeg",
            buffer: Buffer.from(await profileImage.arrayBuffer()),
            prefix: "profile",
          });
          await prisma.user.update({ where: { id: user.id }, data: { image: url } });
        }
      }

      // Handle Business Reg Cert and other certs if present
      if (formData) {
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

        const fileCC = formData.get("cityCouncilCert") as File | null;
        if (fileCC && fileCC.size > 0) {
          const url = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(fileCC.name) || ".pdf",
            contentType: fileCC.type || "application/pdf",
            buffer: Buffer.from(await fileCC.arrayBuffer()),
            prefix: "city-council",
          });
          (businessData as any).cityCouncilCertUrl = url;
        }

        const fileGST = formData.get("gstTinCert") as File | null;
        if (fileGST && fileGST.size > 0) {
          const url = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(fileGST.name) || ".pdf",
            contentType: fileGST.type || "application/pdf",
            buffer: Buffer.from(await fileGST.arrayBuffer()),
            prefix: "gst-tin",
          });
          (businessData as any).gstTinCertUrl = url;
        }

        const fileAP = formData.get("addressProof") as File | null;
        if (fileAP && fileAP.size > 0) {
          const url = await uploadPublicFile({
            folder: "onboarding/business",
            ext: path.extname(fileAP.name) || ".pdf",
            contentType: fileAP.type || "application/pdf",
            buffer: Buffer.from(await fileAP.arrayBuffer()),
            prefix: "address-proof",
          });
          (businessData as any).addressProofUrl = url;
        }
      }

      await prisma.seller.update({
        where: { id: seller.id },
        data: {
          onboardingStep: Math.max(seller.onboardingStep, 3), // Move to identity
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
      // Step 2: Identity Verification (KYC)
      const nationIdentityNumber = formData ? (formData.get("nationIdentityNumber") as string) : jsonBody.data.nationIdentityNumber;

      const kycData: any = formData ? {
        idType: formData.get("idType") as string,
        idNumber: formData.get("idNumber") as string,
      } : { ...jsonBody.data };

      if (nationIdentityNumber) {
        await prisma.seller.update({
          where: { id: seller.id },
          data: { nationIdentityNumber },
        })
      }

      if (formData) {
        const files = ["idFront", "idBack", "selfie"];
        for (const f of files) {
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
          onboardingStep: Math.max(seller.onboardingStep, 4), // Move to bank
          kyc: {
            upsert: {
              create: { ...kycData },
              update: { ...kycData },
            },
          },
        },
      });
    }

    else if (mobileStep === 3) {
      // Step 3: Bank Details
      const bankData: any = formData ? {
        bankName: formData.get("bankName") as string,
        bankAddress: formData.get("bankAddress") as string,
        accountHolderName: formData.get("accountHolderName") as string,
        accountNumber: formData.get("accountNumber") as string,
        bbanNumber: formData.get("bbanNumber") as string,
        branchName: formData.get("branchName") as string,
        preferredPayoutMethod: formData.get("preferredPayoutMethod") as string,
        mobileMoneyOption: formData.get("mobileMoneyOption") as string,
        passbookUrl: seller.bankDetails?.passbookUrl || null,
        bankLetterUrl: seller.bankDetails?.bankLetterUrl || null,
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
        const bankLetter = formData.get("bankLetter") as File | null;
        if (bankLetter && bankLetter.size > 0) {
          bankData.bankLetterUrl = await uploadPublicFile({
            folder: "onboarding/bank",
            ext: path.extname(bankLetter.name) || ".pdf",
            contentType: bankLetter.type || "application/pdf",
            buffer: Buffer.from(await bankLetter.arrayBuffer()),
            prefix: "bank-letter",
          });
        }
      }

      await prisma.seller.update({
        where: { id: seller.id },
        data: {
          onboardingStep: Math.max(seller.onboardingStep, 5), // Move to store
          bankDetails: {
            upsert: {
              create: { ...bankData },
              update: { ...bankData },
            },
          },
        },
      });
    }

    else if (mobileStep === 4) {
      // Step 4: Store Setup
      const storeData: any = formData ? {
        name: formData.get("storeName") as string,
        description: formData.get("description") as string,
      } : { ...jsonBody.data };

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
        if (jsonBody.data.storeLat != undefined && jsonBody.data.storeLng != undefined) {
          storeData.lat = parseFloat(jsonBody.data.storeLat)
          storeData.lng = parseFloat(jsonBody.data.storeLng)
        }
        if (jsonBody.data.storeAddress != undefined) {
          storeData.address = String(jsonBody.data.storeAddress)
        }
      }

      let categoryIds = formData ? formData.getAll("categoryIds") : (jsonBody.data.categoryIds || []);
      
      const suggestionCountRaw = formData ? formData.get("suggestionCount") : jsonBody.data.suggestionCount;
      const suggestionCount = parseInt(suggestionCountRaw as string) || 0;

      for (let i = 0; i < suggestionCount; i++) {
        const suggestedId = formData ? formData.get(`suggestion_id_${i}`) as string : jsonBody.data[`suggestion_id_${i}`];
        const suggestedName = formData ? formData.get(`suggestion_name_${i}`) as string : jsonBody.data[`suggestion_name_${i}`];
        const suggestedDesc = formData ? formData.get(`suggestion_description_${i}`) as string : jsonBody.data[`suggestion_description_${i}`];

        if (suggestedName || suggestedId) {
          // Check if category already exists
          let existing = null;
          if (suggestedId) {
            existing = await prisma.category.findUnique({ where: { id: suggestedId } });
          }

          if (!existing && suggestedName) {
            existing = await prisma.category.findFirst({
              where: {
                OR: [
                  { name: { equals: suggestedName, mode: 'insensitive' } },
                  { slug: generateSlug(suggestedName) }
                ]
              }
            });
          }

          if (existing) {
            if (existing.isActive === false) {
              // Update existing suggestion if it's still pending
              let imageUrl = existing.image;
              let mobileIconUrl = existing.mobileIcon;

              if (formData) {
                const img = formData.get(`suggestion_image_${i}`) as File | null;
                const icon = formData.get(`suggestion_mobile_icon_${i}`) as File | null;
                if (img && img.size > 0) {
                  imageUrl = await uploadPublicFile({
                    folder: "categories",
                    ext: path.extname(img.name) || ".jpg",
                    contentType: img.type || "image/jpeg",
                    buffer: Buffer.from(await img.arrayBuffer()),
                    prefix: "category",
                  });
                }
                if (icon && icon.size > 0) {
                  mobileIconUrl = await uploadPublicFile({
                    folder: "categories",
                    ext: path.extname(icon.name) || ".png",
                    contentType: icon.type || "image/png",
                    buffer: Buffer.from(await icon.arrayBuffer()),
                    prefix: "mobile",
                  });
                }
              }

              await prisma.category.update({
                where: { id: existing.id },
                data: {
                  name: suggestedName || existing.name,
                  slug: suggestedName ? generateSlug(suggestedName) : existing.slug,
                  description: suggestedDesc,
                  image: imageUrl,
                  mobileIcon: mobileIconUrl,
                }
              });
            }
            if (!categoryIds.includes(existing.id)) {
              categoryIds.push(existing.id);
            }
          } else {
            let imageUrl = "";
            let mobileIconUrl = "";

            if (formData) {
              const img = formData.get(`suggestion_image_${i}`) as File | null;
              const icon = formData.get(`suggestion_mobile_icon_${i}`) as File | null;
              if (img && img.size > 0) {
                imageUrl = await uploadPublicFile({
                  folder: "categories",
                  ext: path.extname(img.name) || ".jpg",
                  contentType: img.type || "image/jpeg",
                  buffer: Buffer.from(await img.arrayBuffer()),
                  prefix: "category",
                });
              }
              if (icon && icon.size > 0) {
                mobileIconUrl = await uploadPublicFile({
                  folder: "categories",
                  ext: path.extname(icon.name) || ".png",
                  contentType: icon.type || "image/png",
                  buffer: Buffer.from(await icon.arrayBuffer()),
                  prefix: "mobile",
                });
              }
            }

            const newCat = await prisma.category.create({
              data: {
                name: suggestedName,
                slug: generateSlug(suggestedName),
                description: suggestedDesc,
                image: imageUrl,
                mobileIcon: mobileIconUrl,
                isActive: false,
                isFeatured: false,
              }
            });
            categoryIds.push(newCat.id);
          }
        }
      }

      await prisma.seller.update({
        where: { id: seller.id },
        data: {
          onboardingStep: Math.max(seller.onboardingStep, 6), // Move to agreement
          selectedCategories: {
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
      // Step 5: Agreement & Completion
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
          onboardingStep: 6, // Final completed state in DB
          status: "PENDING", // Reset to pending for admin review
          adminFeedback: null, // Clear old correction feedback
          agreement: {
            upsert: {
              create: { ...agreementData },
              update: { ...agreementData },
            },
          },
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
    console.error("Mobile product seller onboarding error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save onboarding step" },
      { status: 500 }
    );
  }
}

export interface ApprovalValidationResult {
  canApprove: boolean;
  missingItems: string[];
}

/**
 * Validates whether a Product or Service Seller can be approved by Admin.
 * Checks for complete onboarding, required store information, business documents,
 * KYC documents, bank proof, category selections, and signed agreement.
 */
export function validateProductOrServiceSellerApproval(seller: any): ApprovalValidationResult {
  const missingItems: string[] = [];

  if (!seller) {
    return { canApprove: false, missingItems: ["Seller record does not exist"] };
  }

  // 1. Basic Onboarding Status
  if (!seller.onboardingCompleted && (seller.onboardingStep ?? 0) < 6) {
    missingItems.push("Seller has not completed the onboarding process (current step: " + (seller.onboardingStep || 2) + " of 6)");
  }

  // 2. Store Details (Step 1/2)
  if (!seller.store || !seller.store.name?.trim()) {
    missingItems.push("Store name / details are missing");
  }

  // 3. Business Information & Document Uploads (Step 2)
  if (!seller.businessInfo) {
    missingItems.push("Business information is missing");
  } else {
    if (!seller.businessInfo.businessName?.trim()) {
      missingItems.push("Business Name is missing");
    }
    if (!seller.businessInfo.busRegCertUrl?.trim()) {
      missingItems.push("Business Registration Certificate upload is missing");
    }
    if (!seller.businessInfo.addressProofUrl?.trim()) {
      missingItems.push("Proof of Address document upload is missing");
    }
  }

  // 4. Identity & KYC Documents (Step 3)
  if (!seller.kyc) {
    missingItems.push("Identity / KYC details are missing");
  } else {
    if (!seller.kyc.idType?.trim() && !seller.nationIdentityNumber?.trim()) {
      missingItems.push("Identity Type / NIN is missing");
    }
    if (!seller.kyc.idFrontUrl?.trim()) {
      missingItems.push("National ID / Passport Front photo is missing");
    }
    if (!seller.kyc.idBackUrl?.trim()) {
      missingItems.push("National ID / Passport Back photo is missing");
    }
    if (!seller.kyc.selfieUrl?.trim()) {
      missingItems.push("Selfie with ID photo is missing");
    }
  }

  // 5. Bank / Financial Details (Step 4)
  if (!seller.bankDetails) {
    missingItems.push("Bank / Payout details are missing");
  } else {
    const hasAccount = !!seller.bankDetails.accountNumber?.trim() || !!seller.bankDetails.bbanNumber?.trim() || !!seller.bankDetails.mobileMoneyOption?.trim();
    if (!hasAccount) {
      missingItems.push("Bank account number, BBAN, or Mobile Money payout number is missing");
    }
  }

  // 6. Category Selection (Step 5)
  if (seller.type === "PRODUCT") {
    if (!seller.selectedCategories || seller.selectedCategories.length === 0) {
      missingItems.push("At least one Product Category must be selected");
    }
  } else if (seller.type === "SERVICE") {
    if (!seller.selectedServiceCategories || seller.selectedServiceCategories.length === 0) {
      missingItems.push("At least one Service Category must be selected");
    }
  }

  // 7. Agreement (Step 6)
  if (!seller.agreement) {
    missingItems.push("Legal Agreement and compliance review has not been submitted");
  } else {
    if (!seller.agreement.agreedToTerms) {
      missingItems.push("General Terms & Conditions not accepted");
    }
    if (!seller.agreement.agreedToPrivacy) {
      missingItems.push("Privacy Policy & Data Compliance not accepted");
    }
  }

  // 8. Strict Document Completeness Verification
  const docEval = evaluateSellerDocuments(seller, seller.type || "PRODUCT");
  if (!docEval.isComplete) {
    for (const doc of docEval.missingDocuments) {
      const msg = `Required Document Missing: ${doc}`;
      if (!missingItems.includes(msg)) {
        missingItems.push(msg);
      }
    }
  }

  return {
    canApprove: missingItems.length === 0,
    missingItems,
  };
}

/**
 * Validates whether a Hotel Seller can be approved by Admin.
 * Checks for complete onboarding, business documents, KYC documents,
 * property media (logo, banner, main property photo), bank details, and signed agreement.
 */
export function validateHotelSellerApproval(seller: any): ApprovalValidationResult {
  const missingItems: string[] = [];

  if (!seller) {
    return { canApprove: false, missingItems: ["Hotel Seller record does not exist"] };
  }

  // 1. Basic Onboarding Status
  if (!seller.onboardingCompleted && (seller.onboardingStep ?? 0) < 6) {
    missingItems.push("Hotel onboarding workflow has not been completed by seller (current step: " + (seller.onboardingStep || 2) + " of 6)");
  }

  // 2. Business Information & Document Uploads (Step 2)
  if (!seller.businessInfo) {
    missingItems.push("Business information is missing");
  } else {
    if (!seller.businessInfo.businessName?.trim()) {
      missingItems.push("Hotel Business Name is missing");
    }
    if (!seller.businessInfo.busRegCertUrl?.trim()) {
      missingItems.push("Business Registration Certificate upload is missing");
    }
    if (!seller.businessInfo.addressProofUrl?.trim()) {
      missingItems.push("Proof of Address document upload is missing");
    }
  }

  // 3. Identity & KYC Documents (Step 3)
  if (!seller.kyc) {
    missingItems.push("Identity / KYC details are missing");
  } else {
    if (!seller.kyc.idType?.trim()) {
      missingItems.push("Identity Document Type is missing");
    }
    if (!seller.kyc.idFrontUrl?.trim()) {
      missingItems.push("National ID / Passport Front photo is missing");
    }
    if (!seller.kyc.idBackUrl?.trim()) {
      missingItems.push("National ID / Passport Back photo is missing");
    }
    if (!seller.kyc.selfieUrl?.trim()) {
      missingItems.push("Selfie with ID photo is missing");
    }
  }

  // 4. Property Media & Setup (Step 4)
  if (!seller.logo?.trim()) {
    missingItems.push("Hotel Logo upload is missing");
  }
  if (!seller.mainPhoto?.trim()) {
    missingItems.push("Main Property photo upload is missing");
  }

  // 5. Bank / Financial Details (Step 5)
  if (!seller.bankDetails) {
    missingItems.push("Bank / Payout details are missing");
  } else {
    const hasAccount = !!seller.bankDetails.accountNumber?.trim() || !!seller.bankDetails.bbanNumber?.trim() || !!seller.bankDetails.mobileMoneyOption?.trim();
    if (!hasAccount) {
      missingItems.push("Bank account number, BBAN, or Mobile Money payout number is missing");
    }
  }

  // 6. Legal Agreement (Step 6)
  if (!seller.agreement) {
    missingItems.push("Hotel Legal Agreement has not been submitted");
  } else {
    if (!seller.agreement.agreedToTerms) {
      missingItems.push("General Terms & Conditions not accepted");
    }
    if (!seller.agreement.agreedToPrivacy) {
      missingItems.push("Privacy Policy & Data Compliance not accepted");
    }
  }

  // 7. Strict Document Completeness Verification
  const docEval = evaluateSellerDocuments(seller, "HOTEL");
  if (!docEval.isComplete) {
    for (const doc of docEval.missingDocuments) {
      const msg = `Required Document Missing: ${doc}`;
      if (!missingItems.includes(msg)) {
        missingItems.push(msg);
      }
    }
  }

  return {
    canApprove: missingItems.length === 0,
    missingItems,
  };
}

/**
 * Validates whether a Restaurant Seller can be approved by Admin.
 * Checks for complete onboarding, business documents, KYC documents, Food License,
 * culinary media (logo, main photo), bank details, and signed agreement.
 */
export function validateRestaurantSellerApproval(seller: any): ApprovalValidationResult {
  const missingItems: string[] = [];

  if (!seller) {
    return { canApprove: false, missingItems: ["Restaurant Seller record does not exist"] };
  }

  // 1. Basic Onboarding Status
  if (!seller.onboardingCompleted && (seller.onboardingStep ?? 0) < 6) {
    missingItems.push("Restaurant onboarding workflow has not been completed by seller (current step: " + (seller.onboardingStep || 2) + " of 6)");
  }

  // 2. Business Information & Document Uploads (Step 2)
  if (!seller.businessInfo) {
    missingItems.push("Business information is missing");
  } else {
    if (!seller.businessInfo.businessName?.trim()) {
      missingItems.push("Restaurant Business Name is missing");
    }
    if (!seller.businessInfo.busRegCertUrl?.trim()) {
      missingItems.push("Business Registration Certificate upload is missing");
    }
    if (!seller.businessInfo.addressProofUrl?.trim()) {
      missingItems.push("Proof of Address document upload is missing");
    }
  }

  // 3. Identity, KYC & Food License Documents (Step 3)
  if (!seller.kyc) {
    missingItems.push("Identity / KYC details are missing");
  } else {
    if (!seller.kyc.idType?.trim()) {
      missingItems.push("Identity Document Type is missing");
    }
    if (!seller.kyc.idFrontUrl?.trim()) {
      missingItems.push("National ID / Passport Front photo is missing");
    }
    if (!seller.kyc.idBackUrl?.trim()) {
      missingItems.push("National ID / Passport Back photo is missing");
    }
    if (!seller.kyc.selfieUrl?.trim()) {
      missingItems.push("Selfie with ID photo is missing");
    }
    if (!seller.kyc.foodLicenseUrl?.trim()) {
      missingItems.push("Food Hygiene / Sanitation License upload is missing");
    }
  }

  // 4. Culinary Media & Setup (Step 4)
  if (!seller.logo?.trim()) {
    missingItems.push("Restaurant Logo upload is missing");
  }
  if (!seller.mainPhoto?.trim()) {
    missingItems.push("Main Restaurant / Cuisine photo upload is missing");
  }

  // 5. Bank / Financial Details (Step 5)
  if (!seller.bankDetails) {
    missingItems.push("Bank / Payout details are missing");
  } else {
    const hasAccount = !!seller.bankDetails.accountNumber?.trim() || !!seller.bankDetails.bbanNumber?.trim() || !!seller.bankDetails.mobileMoneyOption?.trim();
    if (!hasAccount) {
      missingItems.push("Bank account number, BBAN, or Mobile Money payout number is missing");
    }
  }

  // 6. Legal Agreement (Step 6)
  if (!seller.agreement) {
    missingItems.push("Restaurant Legal Agreement has not been submitted");
  } else {
    if (!seller.agreement.agreedToTerms) {
      missingItems.push("General Terms & Conditions not accepted");
    }
    if (!seller.agreement.agreedToPrivacy) {
      missingItems.push("Privacy Policy & Data Compliance not accepted");
    }
  }

  // 7. Strict Document Completeness Verification
  const docEval = evaluateSellerDocuments(seller, "RESTAURANT");
  if (!docEval.isComplete) {
    for (const doc of docEval.missingDocuments) {
      const msg = `Required Document Missing: ${doc}`;
      if (!missingItems.includes(msg)) {
        missingItems.push(msg);
      }
    }
  }

  return {
    canApprove: missingItems.length === 0,
    missingItems,
  };
}

export interface DocumentItemStatus {
  name: string;
  category: "identity" | "business" | "financial" | "media" | "legal";
  isUploaded: boolean;
  isOptional?: boolean;
  url?: string | null;
}

export interface SellerDocumentEvaluation {
  isComplete: boolean;
  totalRequired: number;
  uploadedCount: number;
  missingCount: number;
  missingDocuments: string[];
  documentsList: DocumentItemStatus[];
}

/**
 * Comprehensive document completeness evaluation for Product, Service, Hotel, and Restaurant sellers.
 * Checks all required legal, identity, corporate, media, and banking documentation.
 */
export function evaluateSellerDocuments(seller: any, sellerType?: string): SellerDocumentEvaluation {
  if (!seller) {
    return {
      isComplete: false,
      totalRequired: 0,
      uploadedCount: 0,
      missingCount: 0,
      missingDocuments: ["No seller data"],
      documentsList: [],
    };
  }

  const normalizedType = (sellerType || seller.type || seller.sellerType || "PRODUCT").toString().toUpperCase();
  const docs: DocumentItemStatus[] = [];

  // 1. Business Certificates
  const busInfo = seller.businessInfo || seller.raw?.businessInfo;
  docs.push({
    name: "Business Registration Certificate",
    category: "business",
    isUploaded: !!busInfo?.busRegCertUrl?.trim(),
    url: busInfo?.busRegCertUrl,
  });
  docs.push({
    name: "City Council Certificate",
    category: "business",
    isUploaded: !!busInfo?.cityCouncilCertUrl?.trim(),
    isOptional: true,
    url: busInfo?.cityCouncilCertUrl,
  });
  docs.push({
    name: "Proof of Address",
    category: "business",
    isUploaded: !!busInfo?.addressProofUrl?.trim(),
    url: busInfo?.addressProofUrl,
  });
  if (busInfo?.haveGst) {
    docs.push({
      name: "GST / TIN Certificate",
      category: "business",
      isUploaded: !!busInfo?.gstTinCertUrl?.trim(),
      url: busInfo?.gstTinCertUrl,
    });
  }

  // 2. Identity / KYC
  const user = seller.user || seller.raw?.user;
  docs.push({
    name: "User Profile Picture",
    category: "identity",
    isUploaded: !!user?.image?.trim(),
    url: user?.image,
  });

  const kyc = seller.kyc || seller.raw?.kyc;
  docs.push({
    name: "ID / Passport Front",
    category: "identity",
    isUploaded: !!kyc?.idFrontUrl?.trim(),
    url: kyc?.idFrontUrl,
  });
  docs.push({
    name: "ID / Passport Back",
    category: "identity",
    isUploaded: !!kyc?.idBackUrl?.trim(),
    url: kyc?.idBackUrl,
  });
  docs.push({
    name: "Selfie with ID",
    category: "identity",
    isUploaded: !!kyc?.selfieUrl?.trim(),
    url: kyc?.selfieUrl,
  });

  // 3. Bank / Financial Proof
  const bank = seller.bankDetails || seller.raw?.bankDetails;
  docs.push({
    name: "Bank Passbook / Cheque Copy",
    category: "financial",
    isUploaded: !!bank?.passbookUrl?.trim(),
    isOptional: false,
    url: bank?.passbookUrl,
  });
  docs.push({
    name: "Bank Verification Letter",
    category: "financial",
    isUploaded: !!bank?.bankLetterUrl?.trim(),
    isOptional: true,
    url: bank?.bankLetterUrl,
  });

  // 4. Media / Special License based on type
  if (normalizedType === "HOTEL") {
    docs.push({
      name: "Hotel Logo",
      category: "media",
      isUploaded: !!(seller.logo?.trim() || seller.raw?.logo?.trim()),
      url: seller.logo || seller.raw?.logo,
    });
    docs.push({
      name: "Hotel Banner",
      category: "media",
      isUploaded: !!(seller.banner?.trim() || seller.raw?.banner?.trim()),
      isOptional: true,
      url: seller.banner || seller.raw?.banner,
    });
    docs.push({
      name: "Main Property Photo",
      category: "media",
      isUploaded: !!(seller.mainPhoto?.trim() || seller.raw?.mainPhoto?.trim()),
      url: seller.mainPhoto || seller.raw?.mainPhoto,
    });
  } else if (normalizedType === "RESTAURANT") {
    docs.push({
      name: "Food Hygiene / Sanitation License",
      category: "business",
      isUploaded: !!kyc?.foodLicenseUrl?.trim() || !!kyc?.foodLicenseNumber?.trim(),
      url: kyc?.foodLicenseUrl,
    });
    docs.push({
      name: "Restaurant Logo",
      category: "media",
      isUploaded: !!(seller.logo?.trim() || seller.raw?.logo?.trim()),
      url: seller.logo || seller.raw?.logo,
    });
    docs.push({
      name: "Restaurant Banner",
      category: "media",
      isUploaded: !!(seller.banner?.trim() || seller.raw?.banner?.trim()),
      isOptional: true,
      url: seller.banner || seller.raw?.banner,
    });
    docs.push({
      name: "Main Cuisine / Restaurant Photo",
      category: "media",
      isUploaded: !!(seller.mainPhoto?.trim() || seller.raw?.mainPhoto?.trim()),
      url: seller.mainPhoto || seller.raw?.mainPhoto,
    });
  } else {
    // PRODUCT or SERVICE sellers
    const store = seller.store || seller.raw?.store;
    const isProduct = normalizedType === "PRODUCT";
    docs.push({
      name: isProduct ? "Store Logo" : "Service Provider Logo",
      category: "media",
      isUploaded: !!(store?.logo?.trim() || seller.logo?.trim() || seller.raw?.logo?.trim()),
      url: store?.logo || seller.logo || seller.raw?.logo,
    });
    docs.push({
      name: isProduct ? "Store Banner" : "Service Provider Banner",
      category: "media",
      isUploaded: !!(store?.banner?.trim() || seller.banner?.trim() || seller.raw?.banner?.trim()),
      isOptional: true,
      url: store?.banner || seller.banner || seller.raw?.banner,
    });
  }

  // 5. Legal Agreement
  const agreement = seller.agreement || seller.raw?.agreement;
  const isAgreementSigned = !!agreement?.agreedToTerms && !!agreement?.agreedToPrivacy;
  docs.push({
    name: "Signed Legal Agreement",
    category: "legal",
    isUploaded: isAgreementSigned,
    url: null,
  });

  const requiredDocs = docs.filter((d) => !d.isOptional);
  const totalRequired = requiredDocs.length;
  const uploadedCount = requiredDocs.filter((d) => d.isUploaded).length;
  const missingDocs = requiredDocs.filter((d) => !d.isUploaded).map((d) => d.name);

  return {
    isComplete: missingDocs.length === 0,
    totalRequired,
    uploadedCount,
    missingCount: missingDocs.length,
    missingDocuments: missingDocs,
    documentsList: docs,
  };
}


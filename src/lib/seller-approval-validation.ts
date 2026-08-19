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
    if (!seller.businessInfo.cityCouncilCertUrl?.trim()) {
      missingItems.push("City Council Certificate upload is missing");
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
    const hasAccount = !!seller.bankDetails.accountNumber?.trim() || !!seller.bankDetails.mobileMoneyOption?.trim();
    if (!hasAccount) {
      missingItems.push("Bank account number or Mobile Money payout number is missing");
    }
    const hasBankProof = !!seller.bankDetails.passbookUrl?.trim() || !!seller.bankDetails.bankLetterUrl?.trim();
    if (!hasBankProof) {
      missingItems.push("Bank passbook or verification letter upload is missing");
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
    if (!seller.businessInfo.cityCouncilCertUrl?.trim()) {
      missingItems.push("City Council Certificate upload is missing");
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
  if (!seller.banner?.trim()) {
    missingItems.push("Hotel Banner upload is missing");
  }
  if (!seller.mainPhoto?.trim()) {
    missingItems.push("Main Property photo upload is missing");
  }

  // 5. Bank / Financial Details (Step 5)
  if (!seller.bankDetails) {
    missingItems.push("Bank / Payout details are missing");
  } else {
    const hasAccount = !!seller.bankDetails.accountNumber?.trim() || !!seller.bankDetails.mobileMoneyOption?.trim();
    if (!hasAccount) {
      missingItems.push("Bank account number or Mobile Money payout number is missing");
    }
    const hasBankProof = !!seller.bankDetails.passbookUrl?.trim() || !!seller.bankDetails.bankLetterUrl?.trim();
    if (!hasBankProof) {
      missingItems.push("Bank passbook or verification letter upload is missing");
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

  return {
    canApprove: missingItems.length === 0,
    missingItems,
  };
}

/**
 * Validates whether a Restaurant Seller can be approved by Admin.
 * Checks for complete onboarding, business documents, KYC documents, Food License,
 * culinary media (logo, banner, main photo), bank details, and signed agreement.
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
    if (!seller.businessInfo.cityCouncilCertUrl?.trim()) {
      missingItems.push("City Council Certificate upload is missing");
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
  if (!seller.banner?.trim()) {
    missingItems.push("Restaurant Banner upload is missing");
  }
  if (!seller.mainPhoto?.trim()) {
    missingItems.push("Main Restaurant / Cuisine photo upload is missing");
  }

  // 5. Bank / Financial Details (Step 5)
  if (!seller.bankDetails) {
    missingItems.push("Bank / Payout details are missing");
  } else {
    const hasAccount = !!seller.bankDetails.accountNumber?.trim() || !!seller.bankDetails.mobileMoneyOption?.trim();
    if (!hasAccount) {
      missingItems.push("Bank account number or Mobile Money payout number is missing");
    }
    const hasBankProof = !!seller.bankDetails.passbookUrl?.trim() || !!seller.bankDetails.bankLetterUrl?.trim();
    if (!hasBankProof) {
      missingItems.push("Bank passbook or verification letter upload is missing");
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

  return {
    canApprove: missingItems.length === 0,
    missingItems,
  };
}

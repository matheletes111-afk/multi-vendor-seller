import {
  validateProductOrServiceSellerApproval,
  validateHotelSellerApproval,
  validateRestaurantSellerApproval,
  evaluateSellerDocuments,
} from "../src/lib/seller-approval-validation";

console.log("=== RUNNING SELLER APPROVAL & DOCUMENT OPTIONALITY TESTS ===\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, extra?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`, extra ? extra : "");
    failed++;
  }
}

// 1. PRODUCT SELLER - Minimal Required Data (NO City Council, NO Bank Passbook, NO Banner)
const minimalProductSeller: any = {
  id: "prod-seller-1",
  type: "PRODUCT",
  phone: "+23276123456",
  onboardingCompleted: true,
  onboardingStep: 6,
  user: { name: "John Doe", email: "john@example.com", phone: "+23276123456" },
  businessInfo: {
    businessName: "John Trading Ltd",
    busRegCertUrl: "https://example.com/busreg.pdf",
    addressProofUrl: "https://example.com/address.pdf",
    cityCouncilCertUrl: null, // OPTIONAL
    gstTinCertUrl: null,
    haveGst: false,
  },
  kyc: {
    idType: "National ID",
    idNumber: "12345678",
    idFrontUrl: "https://example.com/idfront.jpg",
    idBackUrl: "https://example.com/idback.jpg",
    selfieUrl: "https://example.com/selfie.jpg",
  },
  bankDetails: {
    bankName: "Rokel Commercial Bank",
    accountNumber: "00123456789",
    bbanNumber: "SL001002003004",
    passbookUrl: null, // OPTIONAL
    bankLetterUrl: null, // OPTIONAL
  },
  store: {
    name: "John's Store",
    logo: "https://example.com/logo.png",
    banner: null, // OPTIONAL
  },
  selectedCategories: [{ id: "cat-1", name: "Fashion" }],
  agreement: {
    agreedToTerms: true,
    agreedToPrivacy: true,
    agreedToCommission: true,
  },
};

const prodValidation = validateProductOrServiceSellerApproval(minimalProductSeller);
assert(prodValidation.canApprove, "Product seller with only mandatory docs passes approval validation", prodValidation.missingItems);

const prodDocEval = evaluateSellerDocuments(minimalProductSeller, "PRODUCT");
assert(prodDocEval.isComplete, "Product seller document checklist is complete without City Council, Passbook, or Banner", prodDocEval.missingDocuments);
assert(prodDocEval.missingDocuments.length === 0, "Missing documents list is empty for minimal product seller");

// 2. SERVICE SELLER - Minimal Required Data
const minimalServiceSeller: any = {
  id: "srv-seller-1",
  type: "SERVICE",
  phone: "+23278999888",
  onboardingCompleted: true,
  onboardingStep: 6,
  user: { name: "Alpha Services", email: "alpha@example.com", phone: "+23278999888" },
  businessInfo: {
    businessName: "Alpha Repairs",
    busRegCertUrl: "https://example.com/busreg.pdf",
    addressProofUrl: "https://example.com/address.pdf",
    cityCouncilCertUrl: null,
  },
  kyc: {
    idType: "Passport",
    idNumber: "P123456",
    idFrontUrl: "https://example.com/idfront.jpg",
    idBackUrl: "https://example.com/idback.jpg",
    selfieUrl: "https://example.com/selfie.jpg",
  },
  bankDetails: {
    mobileMoneyOption: "Orange Money (+23278999888)",
    passbookUrl: null,
  },
  store: {
    name: "Alpha Repair Shop",
    logo: "https://example.com/logo.png",
    banner: null,
  },
  selectedServiceCategories: [{ id: "scat-1", name: "Electronics Repair" }],
  agreement: {
    agreedToTerms: true,
    agreedToPrivacy: true,
    agreedToCommission: true,
  },
};

const srvValidation = validateProductOrServiceSellerApproval(minimalServiceSeller);
assert(srvValidation.canApprove, "Service seller with Mobile Money and without optional docs passes approval validation", srvValidation.missingItems);

const srvDocEval = evaluateSellerDocuments(minimalServiceSeller, "SERVICE");
assert(srvDocEval.isComplete, "Service seller document checklist is complete", srvDocEval.missingDocuments);

// 3. HOTEL SELLER - Minimal Required Data
const minimalHotelSeller: any = {
  id: "hotel-seller-1",
  logo: "https://example.com/hotel-logo.jpg",
  banner: null, // OPTIONAL
  mainPhoto: "https://example.com/hotel-main.jpg",
  onboardingCompleted: true,
  onboardingStep: 6,
  user: { name: "Grand Hotel", email: "grand@hotel.sl", phone: "+23230111222" },
  businessInfo: {
    businessName: "Grand Hotel Sierra Leone",
    busRegCertUrl: "https://example.com/hotel-busreg.pdf",
    addressProofUrl: "https://example.com/hotel-addr.pdf",
    cityCouncilCertUrl: null, // OPTIONAL
  },
  kyc: {
    idType: "National ID",
    idNumber: "SL-HT-999",
    idFrontUrl: "https://example.com/h-front.jpg",
    idBackUrl: "https://example.com/h-back.jpg",
    selfieUrl: "https://example.com/h-selfie.jpg",
  },
  bankDetails: {
    bankName: "Sierra Leone Commercial Bank",
    bbanNumber: "SL987654321000",
    passbookUrl: null, // OPTIONAL
  },
  agreement: {
    agreedToTerms: true,
    agreedToPrivacy: true,
    agreedToCommission: true,
  },
};

const hotelValidation = validateHotelSellerApproval(minimalHotelSeller);
assert(hotelValidation.canApprove, "Hotel seller without Banner, City Council, or Passbook passes approval validation", hotelValidation.missingItems);

const hotelDocEval = evaluateSellerDocuments(minimalHotelSeller, "HOTEL");
assert(hotelDocEval.isComplete, "Hotel seller document checklist is complete", hotelDocEval.missingDocuments);

// 4. RESTAURANT SELLER - Minimal Required Data
const minimalRestaurantSeller: any = {
  id: "rest-seller-1",
  logo: "https://example.com/rest-logo.jpg",
  banner: null, // OPTIONAL
  mainPhoto: "https://example.com/rest-main.jpg",
  onboardingCompleted: true,
  onboardingStep: 6,
  user: { name: "Tasty Bites", email: "tasty@bites.sl", phone: "+23277333444" },
  businessInfo: {
    businessName: "Tasty Bites Restaurant",
    busRegCertUrl: "https://example.com/rest-busreg.pdf",
    addressProofUrl: "https://example.com/rest-addr.pdf",
    cityCouncilCertUrl: null, // OPTIONAL
  },
  kyc: {
    idType: "Driver License",
    idNumber: "DL-888999",
    idFrontUrl: "https://example.com/r-front.jpg",
    idBackUrl: "https://example.com/r-back.jpg",
    selfieUrl: "https://example.com/r-selfie.jpg",
    foodLicenseUrl: "https://example.com/food-cert.pdf",
  },
  bankDetails: {
    bankName: "Zenith Bank Sierra Leone",
    accountNumber: "2233445566",
    passbookUrl: null, // OPTIONAL
  },
  agreement: {
    agreedToTerms: true,
    agreedToPrivacy: true,
    agreedToCommission: true,
  },
};

const restValidation = validateRestaurantSellerApproval(minimalRestaurantSeller);
assert(restValidation.canApprove, "Restaurant seller without Banner, City Council, or Passbook passes approval validation", restValidation.missingItems);

const restDocEval = evaluateSellerDocuments(minimalRestaurantSeller, "RESTAURANT");
assert(restDocEval.isComplete, "Restaurant seller document checklist is complete", restDocEval.missingDocuments);

// 5. Missing mandatory check: missing Bus Reg Cert should still fail
const missingMandatorySeller: any = {
  ...minimalProductSeller,
  businessInfo: {
    ...minimalProductSeller.businessInfo,
    busRegCertUrl: null,
  },
};
const missingValidation = validateProductOrServiceSellerApproval(missingMandatorySeller);
assert(!missingValidation.canApprove, "Seller missing Business Registration Certificate fails validation");
const missingDocEval = evaluateSellerDocuments(missingMandatorySeller, "PRODUCT");
assert(!missingDocEval.isComplete, "Document evaluation correctly flags missing Business Registration");
assert(missingDocEval.missingDocuments.includes("Business Registration Certificate"), "Missing documents list contains Business Registration Certificate");

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}

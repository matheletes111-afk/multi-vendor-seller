import fs from 'fs';
import path from 'path';

const extractedDir = path.join(process.cwd(), 'terms', 'extracted');

function readExtracted(filename) {
  const filePath = path.join(extractedDir, filename);
  return fs.readFileSync(filePath, 'utf-8').trim();
}

function textToHtml(title, text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let html = `<div class="legal-document">\n  <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">${title}</h1>\n`;
  
  for (const line of lines) {
    if (line.match(/^(\d+\.|\b[A-Z\s]{4,}\b)/) && line.length < 80) {
      html += `  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">${line}</h2>\n`;
    } else if (line.startsWith('•') || line.startsWith('○') || line.startsWith('●')) {
      html += `  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 4px 0 4px 16px;">${line}</p>\n`;
    } else {
      html += `  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">${line}</p>\n`;
    }
  }
  html += `</div>`;
  return html;
}

const doc1_aml = readExtracted('AML_CFT Policy ( Anty Money Laundering Policy) ~ Meeemsl (1).txt');
const doc2_cyber1 = readExtracted('Cyber Security Policy~MEEEM Ecommerce Pvt. Ltd..txt');
const doc3_dataprot = readExtracted('Data Protection & Privacy Compliance document .txt');
const doc4_buyer = readExtracted('MEEEM Buyer\'s Terms Summery.txt');
const doc5_cyber2 = readExtracted('MEEEM Cybersecurity Policy.txt');
const doc6_exchange = readExtracted('MEEEM EXCHANGE POLICY.txt');
const doc7_vendor = readExtracted('MEEEM Vendor (Seller) & Service Provider Agreement .txt');
const doc8_payment = readExtracted('Payment Setteling Process Terms % Implementation.txt');

// Web footer terms and privacy
const footerTermsText = `TERMS AND CONDITIONS - MEEEM MARKETPLACE
Last Updated: July 10, 2026

Welcome to MEEEM Marketplace. Please read these Terms and Conditions carefully before using our platform, which includes our website, mobile applications, and related e-commerce and services systems.

1. Acceptance of Terms
By accessing, browsing, or using MEEEM Marketplace (referred to as "the Platform," "we," "us," or "our"), you agree to be bound by these Terms and Conditions, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws.

2. User Accounts and Security
To access certain features of the Platform (such as buying, listing products/services, booking hotels, or ordering food), you must register and maintain an active user account.

3. Marketplace Transactions
MEEEM Marketplace facilitates transactions between buyers and independent sellers (Product Sellers, Service Providers, Hotels, and Restaurants).

4. User Conduct
You agree to use the Platform only for lawful purposes.

5. Intellectual Property Rights
All content on the Platform is the property of MEEEM Marketplace or its content suppliers and is protected by international copyright laws.

6. Limitation of Liability
MEEEM Marketplace shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from platform use.

7. Changes to Terms
We reserve the right to revise or update these Terms and Conditions at any time.

8. Contact Us
Email: info@meeemsl.com / Support@meeemsl.com
Address: Freetown, Sierra Leone`;

const footerPrivacyText = `PRIVACY POLICY - MEEEM MARKETPLACE
Last Updated: July 10, 2026

At MEEEM Marketplace (referred to as "MEEEM," "we," "our," or "us"), we respect your privacy and are committed to protecting your personal data.

1. Information We Collect
We collect Account Registration Info, Transaction Data, Location Data, and Usage & Device Information.

2. How We Use Your Information
To create and manage accounts, process payments, fulfill orders, deliver packages, and send security alerts.

3. Information Sharing and Disclosure
We do not sell your personal data. We share information only with sellers, payment processors, and legal authorities when required.

4. Data Security
We use industry-standard encryption, SSL/TLS, and access controls to safeguard data.

5. Your Data Rights
You have rights to access, correct, or request deletion of your personal data.

6. Cookies and Tracking
We use cookies to maintain login sessions and track platform performance.

7. Contact Us
Email: info@meeemsl.com / Support@meeemsl.com
Address: Freetown, Sierra Leone`;

const tsContent = `export type LegalDocCategory = "core" | "seller" | "buyer" | "compliance" | "security";

export interface LegalDocument {
  id: string
  slug: string
  title: string
  source: string
  lastUpdated: string
  summary: string
  category: LegalDocCategory
  applicableRoles: string[]
  content: string
  rawText: string
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  // 1. Web Footer Terms & Conditions
  {
    id: "footer-terms-and-conditions",
    slug: "terms-and-conditions",
    title: "Terms and Conditions (Web Footer)",
    source: "Web Footer Page",
    lastUpdated: "July 10, 2026",
    summary: "General platform terms of use, marketplace transactions, account conduct, and liability terms.",
    category: "core",
    applicableRoles: ["ADMIN", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_HOTEL", "SELLER_RESTAURANT", "CUSTOMER"],
    content: ${JSON.stringify(textToHtml("Terms and Conditions", footerTermsText))},
    rawText: ${JSON.stringify(footerTermsText)},
  },
  // 2. Web Footer Privacy Policy
  {
    id: "footer-privacy-policy",
    slug: "privacy-policy",
    title: "Privacy Policy (Web Footer)",
    source: "Web Footer Page",
    lastUpdated: "July 10, 2026",
    summary: "Platform privacy disclosures, user data rights, transaction tracking, and cookie policies.",
    category: "core",
    applicableRoles: ["ADMIN", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_HOTEL", "SELLER_RESTAURANT", "CUSTOMER"],
    content: ${JSON.stringify(textToHtml("Privacy Policy", footerPrivacyText))},
    rawText: ${JSON.stringify(footerPrivacyText)},
  },
  // 3. AML / CFT Policy
  {
    id: "aml-cft-policy",
    slug: "aml-cft-policy",
    title: "Anti-Money Laundering (AML) & Counter Financing of Terrorism (CFT) Policy",
    source: "AML_CFT Policy ( Anty Money Laundering Policy) ~ Meeemsl (1).docx",
    lastUpdated: "August 2026",
    summary: "Financial regulatory compliance, mandatory seller CDD/KYC, transaction monitoring, and fraud reporting.",
    category: "compliance",
    applicableRoles: ["ADMIN", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_HOTEL", "SELLER_RESTAURANT"],
    content: ${JSON.stringify(textToHtml("Anti-Money Laundering (AML) & Counter Financing of Terrorism (CFT) Policy", doc1_aml))},
    rawText: ${JSON.stringify(doc1_aml)},
  },
  // 4. Cyber Security Policy (MEEEM Ecommerce Pvt. Ltd.)
  {
    id: "cyber-security-policy-ecommerce",
    slug: "cyber-security-policy-ecommerce",
    title: "Cyber Security Policy ~ MEEEM Ecommerce Pvt. Ltd.",
    source: "Cyber Security Policy~MEEEM Ecommerce Pvt. Ltd..docx",
    lastUpdated: "August 2026",
    summary: "Information assets protection, RBAC access controls, encryption standards, and user security responsibilities.",
    category: "security",
    applicableRoles: ["ADMIN", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_HOTEL", "SELLER_RESTAURANT"],
    content: ${JSON.stringify(textToHtml("Cyber Security Policy ~ MEEEM Ecommerce Pvt. Ltd.", doc2_cyber1))},
    rawText: ${JSON.stringify(doc2_cyber1)},
  },
  // 5. Data Protection & Privacy Compliance Policy
  {
    id: "data-protection-privacy",
    slug: "data-protection-privacy",
    title: "Data Protection & Privacy Compliance Policy",
    source: "Data Protection & Privacy Compliance document .docx",
    lastUpdated: "August 2026",
    summary: "Cloud infrastructure protection (AWS EC2/S3, PostgreSQL), JWT API encryption, and user data rights.",
    category: "compliance",
    applicableRoles: ["ADMIN", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_HOTEL", "SELLER_RESTAURANT", "CUSTOMER"],
    content: ${JSON.stringify(textToHtml("Data Protection & Privacy Compliance Policy", doc3_dataprot))},
    rawText: ${JSON.stringify(doc3_dataprot)},
  },
  // 6. MEEEM Buyer's Terms Summary
  {
    id: "buyer-terms-summary",
    slug: "buyer-terms-summary",
    title: "MEEEM Buyer's Terms and Conditions Summary",
    source: "MEEEM Buyer's Terms Summery.docx",
    lastUpdated: "August 2026",
    summary: "Customer purchasing terms, buyer protection, payment options, fraud prevention, and return eligibility.",
    category: "buyer",
    applicableRoles: ["ADMIN", "CUSTOMER"],
    content: ${JSON.stringify(textToHtml("MEEEM Buyer's Terms and Conditions Summary", doc4_buyer))},
    rawText: ${JSON.stringify(doc4_buyer)},
  },
  // 7. MEEEM Cybersecurity Policy
  {
    id: "meeem-cybersecurity-policy",
    slug: "meeem-cybersecurity-policy",
    title: "MEEEM Cybersecurity Policy",
    source: "MEEEM Cybersecurity Policy.docx",
    lastUpdated: "August 2026",
    summary: "Comprehensive internal cybersecurity protocols, system governance, data classifications, and compliance.",
    category: "security",
    applicableRoles: ["ADMIN"],
    content: ${JSON.stringify(textToHtml("MEEEM Cybersecurity Policy", doc5_cyber2))},
    rawText: ${JSON.stringify(doc5_cyber2)},
  },
  // 8. MEEEM Exchange Policy
  {
    id: "exchange-policy",
    slug: "exchange-policy",
    title: "MEEEM Exchange & Return Policy",
    source: "MEEEM EXCHANGE POLICY.docx",
    lastUpdated: "August 2026",
    summary: "Product return/exchange guidelines, defective item handling, replacement shipping, and seller rules.",
    category: "seller",
    applicableRoles: ["ADMIN", "SELLER_PRODUCT", "CUSTOMER"],
    content: ${JSON.stringify(textToHtml("MEEEM Exchange & Return Policy", doc6_exchange))},
    rawText: ${JSON.stringify(doc6_exchange)},
  },
  // 9. MEEEM Vendor & Service Provider Agreement
  {
    id: "vendor-agreement",
    slug: "vendor-agreement",
    title: "MEEEM Vendor (Seller) & Service Provider Agreement",
    source: "MEEEM Vendor (Seller) & Service Provider Agreement .docx",
    lastUpdated: "August 2026",
    summary: "Official vendor agreement covering listing rules, commission structure, payout cycles, and merchant obligations.",
    category: "seller",
    applicableRoles: ["ADMIN", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_HOTEL", "SELLER_RESTAURANT"],
    content: ${JSON.stringify(textToHtml("MEEEM Vendor (Seller) & Service Provider Agreement", doc7_vendor))},
    rawText: ${JSON.stringify(doc7_vendor)},
  },
  // 10. Payment Settling Process Terms
  {
    id: "payment-settling-process",
    slug: "payment-settling-process",
    title: "Payment Settling Process Terms & Implementation",
    source: "Payment Setteling Process Terms % Implementation.docx",
    lastUpdated: "August 2026",
    summary: "Automated 12-72h escrow settlement flow, instant release on buyer approval, and dispute hold rules.",
    category: "seller",
    applicableRoles: ["ADMIN", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_HOTEL", "SELLER_RESTAURANT"],
    content: ${JSON.stringify(textToHtml("Payment Settling Process Terms & Implementation", doc8_payment))},
    rawText: ${JSON.stringify(doc8_payment)},
  }
];

export const LEGAL_DOCS_BY_SLUG: Record<string, LegalDocument> = {
  // Web Footer slugs & aliases
  "terms-and-conditions": LEGAL_DOCUMENTS[0],
  "terms": LEGAL_DOCUMENTS[0],
  "footer-terms": LEGAL_DOCUMENTS[0],
  "privacy-policy": LEGAL_DOCUMENTS[1],
  "privacy": LEGAL_DOCUMENTS[1],
  "footer-privacy": LEGAL_DOCUMENTS[1],

  // 8 Terms folder document slugs & aliases
  "aml-cft-policy": LEGAL_DOCUMENTS[2],
  "aml-policy": LEGAL_DOCUMENTS[2],
  "aml": LEGAL_DOCUMENTS[2],

  "cyber-security-policy-ecommerce": LEGAL_DOCUMENTS[3],
  "cyber-security-ecommerce": LEGAL_DOCUMENTS[3],

  "data-protection-privacy": LEGAL_DOCUMENTS[4],
  "data-protection": LEGAL_DOCUMENTS[4],

  "buyer-terms-summary": LEGAL_DOCUMENTS[5],
  "buyer-terms": LEGAL_DOCUMENTS[5],

  "meeem-cybersecurity-policy": LEGAL_DOCUMENTS[6],
  "cybersecurity-policy": LEGAL_DOCUMENTS[6],
  "cybersecurity": LEGAL_DOCUMENTS[6],

  "exchange-policy": LEGAL_DOCUMENTS[7],
  "return-policy": LEGAL_DOCUMENTS[7],

  "vendor-agreement": LEGAL_DOCUMENTS[8],
  "seller-agreement": LEGAL_DOCUMENTS[8],
  "seller-terms": LEGAL_DOCUMENTS[8],

  "payment-settling-process": LEGAL_DOCUMENTS[9],
  "payment-settlement": LEGAL_DOCUMENTS[9],
  "payment-settlement-policy": LEGAL_DOCUMENTS[9],
};

export const FOOTER_TERMS_DOC = LEGAL_DOCUMENTS[0];
export const FOOTER_PRIVACY_DOC = LEGAL_DOCUMENTS[1];
export const AML_CFT_DOC = LEGAL_DOCUMENTS[2];
export const CYBER_SECURITY_ECOMMERCE_DOC = LEGAL_DOCUMENTS[3];
export const DATA_PROTECTION_DOC = LEGAL_DOCUMENTS[4];
export const BUYER_TERMS_DOC = LEGAL_DOCUMENTS[5];
export const MEEEM_CYBERSECURITY_DOC = LEGAL_DOCUMENTS[6];
export const EXCHANGE_POLICY_DOC = LEGAL_DOCUMENTS[7];
export const VENDOR_AGREEMENT_DOC = LEGAL_DOCUMENTS[8];
export const PAYMENT_SETTLING_DOC = LEGAL_DOCUMENTS[9];

/**
 * Returns legal documents filtered by user role.
 */
export function getLegalDocumentsForRole(role?: string | null): LegalDocument[] {
  if (!role || role === "ADMIN") {
    return LEGAL_DOCUMENTS;
  }
  const normRole = role.toUpperCase();
  return LEGAL_DOCUMENTS.filter((doc) => doc.applicableRoles.includes(normRole));
}

/**
 * Returns category details for UI filtering.
 */
export const LEGAL_CATEGORIES: { id: LegalDocCategory | "all"; label: string; count?: number }[] = [
  { id: "all", label: "All Documents" },
  { id: "core", label: "Core Platform Terms" },
  { id: "seller", label: "Seller & Agreements" },
  { id: "buyer", label: "Buyer & Marketplace" },
  { id: "compliance", label: "Regulatory & Compliance" },
  { id: "security", label: "Security & Operations" },
];
`;

fs.writeFileSync(path.join(process.cwd(), 'src', 'lib', 'terms-data.ts'), tsContent, 'utf-8');
console.log('src/lib/terms-data.ts generated successfully with 10 documents and role mappings!');

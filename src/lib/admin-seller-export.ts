"use client"

import type { SellerDocumentEvaluation } from "@/lib/seller-approval-validation"

/**
 * Format any value into a clean, safe string for Excel.
 * Prevents [object Object], undefined, null, and numeric corruption.
 */
function toSafeString(val: any): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "boolean") return val ? "Yes" : "No"
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? "" : val.toISOString().replace("T", " ").substring(0, 19)
  }
  if (typeof val === "string") {
    // Check if it's an ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const d = new Date(val)
      if (!isNaN(d.getTime())) {
        return d.toISOString().replace("T", " ").substring(0, 19)
      }
    }
    return val.trim()
  }
  if (typeof val === "number") {
    return String(val)
  }
  if (Array.isArray(val)) {
    return val.map((v) => toSafeString(v)).filter(Boolean).join(", ")
  }
  if (typeof val === "object") {
    return JSON.stringify(val)
  }
  return String(val).trim()
}

/**
 * Format phone numbers safely with country code prefix as plain text string.
 */
function formatPhone(code?: string | null, phone?: string | null): string {
  if (!phone) return ""
  const cleanPhone = String(phone).trim()
  if (!cleanPhone) return ""
  if (code && code.trim()) {
    const cleanCode = code.trim().startsWith("+") ? code.trim() : `+${code.trim()}`
    return `${cleanCode} ${cleanPhone}`
  }
  return cleanPhone
}

/**
 * Format human-readable status badge text.
 */
function formatSellerStatus(item: {
  isApproved?: boolean
  isSuspended?: boolean
  status?: string
  onboardingCompleted?: boolean
  onboardingStep?: number
}): string {
  if (item.isSuspended) return "Suspended"
  if (item.status === "REJECTED") return "Rejected"
  if (item.status === "CORRECTION" || item.status === "CORRECTION_NEEDED") return "Correction Needed"
  if (item.isApproved) return "Approved"
  if (!item.onboardingCompleted) {
    return `Onboarding (Step ${item.onboardingStep ?? 1}/6)`
  }
  return "Pending Review"
}

/**
 * Format document evaluation details matching UI badges and lists.
 */
function formatDocStatus(docEval?: SellerDocumentEvaluation | null) {
  if (!docEval) {
    return {
      badge: "Pending Check",
      status: "Not Evaluated",
      ratio: "0/0",
      missingCount: "0",
      missingAll: "N/A",
      verifiedAll: "N/A",
    }
  }

  const isComplete = docEval.isComplete
  const uploaded = docEval.uploadedCount || 0
  const total = docEval.totalRequired || 0
  const missingCount = docEval.missingCount || 0
  const missingDocs = Array.isArray(docEval.missingDocuments) ? docEval.missingDocuments : []
  const uploadedDocs = Array.isArray(docEval.documentsList)
    ? docEval.documentsList.filter((d) => d.isUploaded).map((d) => d.name)
    : []

  // Exactly mirrors UI badges from screenshot: "Complete (8/8)" or "Incomplete (5 missing)"
  const badge = isComplete
    ? `Complete (${uploaded}/${total})`
    : `Incomplete (${missingCount} missing)`

  return {
    badge,
    status: isComplete ? "Complete" : "Incomplete",
    ratio: `${uploaded}/${total}`,
    missingCount: String(missingCount),
    // Complete, un-truncated list of ALL missing fields/documents
    missingAll:
      missingDocs.length > 0
        ? missingDocs.join(", ")
        : "None (All Required Documents Verified)",
    // Complete list of verified / uploaded documents
    verifiedAll:
      uploadedDocs.length > 0
        ? uploadedDocs.join(", ")
        : "None (No Documents Uploaded)",
  }
}

/**
 * Core engine: Convert flat row records to an Excel .xlsx file where EVERY cell
 * is strictly forced to string type ('s') with text format ('@') so no values
 * are converted to scientific notation, lose leading zeroes, or display erroneously.
 */
export async function exportRowsToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, string>[]
) {
  if (!rows || rows.length === 0) {
    throw new Error("No records available to export.")
  }

  // Dynamically load xlsx only when user clicks export
  const XLSX = await import("xlsx")

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Force EVERY cell in the sheet to string type ('s') with text format code ('@')
  if (worksheet["!ref"]) {
    const range = XLSX.utils.decode_range(worksheet["!ref"])
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = worksheet[cellAddress]
        if (cell) {
          cell.t = "s" // String type
          cell.z = "@" // Standard Excel text display format
          cell.v = String(cell.v ?? "")
        }
      }
    }
  }

  // Calculate dynamic auto-fit column widths
  const headers = Object.keys(rows[0] || {})
  worksheet["!cols"] = headers.map((header) => {
    let maxLen = header.length
    for (let i = 0; i < Math.min(rows.length, 150); i++) {
      const val = rows[i][header]
      if (val && val.length > maxLen) {
        maxLen = val.length
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 14), 70) }
  })

  // Create workbook and write buffer
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31))

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  const safeFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = downloadUrl
  a.download = safeFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(downloadUrl)
}

/**
 * 1. Export All 4 Sellers Master Directory
 */
export async function exportAllSellersToExcel(sellers: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `all_sellers_master_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = sellers.map((item, idx) => {
    const raw = item.raw || {}
    const busInfo = raw.businessInfo || {}
    const kyc = raw.kyc || {}
    const bank = raw.bankDetails || {}
    const agree = raw.agreement || {}
    const docEval = formatDocStatus(item.documentEvaluation)

    const sellerTypeLabel =
      item.sellerType === "PRODUCT"
        ? "Product Seller"
        : item.sellerType === "SERVICE"
        ? "Service Seller"
        : item.sellerType === "HOTEL"
        ? "Hotel Seller"
        : item.sellerType === "RESTAURANT"
        ? "Restaurant Seller"
        : toSafeString(item.sellerType)

    return {
      "SL No": String(idx + 1),
      "Seller ID": toSafeString(item.id),
      "Seller Type": sellerTypeLabel,
      "Store / Business Name": toSafeString(item.businessName || item.storeName),
      "Store Name": toSafeString(item.storeName),
      "Contact Person": toSafeString(item.userName),
      "Email Address": toSafeString(item.userEmail),
      "Phone Number": formatPhone(item.userPhoneCountryCode, item.userPhone),
      "City": toSafeString(item.city || busInfo.city),
      "State / Region": toSafeString(item.state || busInfo.state || busInfo.district),
      "Full Address": toSafeString(busInfo.address || raw.store?.address),
      "Account Status": formatSellerStatus(item),
      "Document Status Badge": docEval.badge,
      "Document Compliance": docEval.status,
      "Documents Ratio": docEval.ratio,
      "Missing Documents Count": docEval.missingCount,
      "All Missing Fields / Documents": docEval.missingAll,
      "Verified Documents": docEval.verifiedAll,
      "Is Approved": item.isApproved ? "Yes" : "No",
      "Is Suspended": item.isSuspended ? "Yes" : "No",
      "Onboarding Complete": item.onboardingCompleted ? "Yes" : "No",
      "Onboarding Step": item.onboardingCompleted ? "Completed (6/6)" : `Step ${item.onboardingStep ?? 1}/6`,
      "Subscription Plan": toSafeString(item.subscriptionPlan || "Free"),
      "Commission Rate (%)": `${toSafeString(item.commissionRate ?? item.baseCommissionRate ?? 10)}%`,
      "Total Listings / Items": toSafeString(item.itemsCount ?? 0),
      "Total Orders": toSafeString(item.ordersCount ?? 0),
      "Business Reg Number": toSafeString(busInfo.businessRegNumber),
      "Business Reg Doc URL": toSafeString(busInfo.busRegCertUrl),
      "Tax ID / TIN": toSafeString(busInfo.taxIdNumber),
      "ID Type": toSafeString(kyc.idType),
      "ID Number": toSafeString(kyc.idNumber),
      "ID Front URL": toSafeString(kyc.idFrontUrl),
      "ID Back URL": toSafeString(kyc.idBackUrl),
      "Selfie with ID URL": toSafeString(kyc.selfieUrl),
      "Food License Number": toSafeString(kyc.foodLicenseNumber),
      "Food License URL": toSafeString(kyc.foodLicenseUrl),
      "Bank Name": toSafeString(bank.bankName),
      "Bank Account Name": toSafeString(bank.accountName),
      "Bank Account Number": toSafeString(bank.accountNumber),
      "Bank Routing / Swift": toSafeString(bank.routingNumber),
      "Bank Branch": toSafeString(bank.branchName),
      "Bank Passbook / Cheque URL": toSafeString(bank.passbookUrl),
      "Referral Source": toSafeString(item.referredBy || item.hearAboutUs || agree.hearAboutUs),
      "Admin Feedback": toSafeString(item.adminFeedback),
      "Registered At": toSafeString(item.createdAt),
      "Last Updated At": toSafeString(item.updatedAt),
    }
  })

  await exportRowsToExcel(filename, "All Sellers", rows)
}

/**
 * 2. Export Product & Service Sellers
 */
export async function exportProductServiceSellersToExcel(sellers: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `product_service_sellers_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = sellers.map((s, idx) => {
    const user = s.user || {}
    const store = s.store || {}
    const busInfo = s.businessInfo || {}
    const kyc = s.kyc || {}
    const bank = s.bankDetails || {}
    const agree = s.agreement || {}
    const docEval = formatDocStatus(s.documentEvaluation)

    const sellerTypeLabel = s.type === "SERVICE" ? "Service Seller" : "Product Seller"
    const itemsCount = s.type === "SERVICE" ? (s._count?.services ?? 0) : (s._count?.products ?? 0)

    return {
      "SL No": String(idx + 1),
      "Seller ID": toSafeString(s.id),
      "Seller Type": sellerTypeLabel,
      "Store Name": toSafeString(store.name),
      "Business Name": toSafeString(busInfo.businessName || store.name),
      "Owner Name": toSafeString(user.name),
      "Email Address": toSafeString(user.email),
      "Phone Number": formatPhone(user.phoneCountryCode, user.phone || store.phone),
      "Store Phone": toSafeString(store.phone),
      "City": toSafeString(store.city || busInfo.city),
      "State": toSafeString(store.state || busInfo.state),
      "Postal Code": toSafeString(store.postalCode || busInfo.postalCode),
      "Address": toSafeString(store.address || busInfo.address),
      "Account Status": formatSellerStatus(s),
      "Document Status Badge": docEval.badge,
      "Document Compliance": docEval.status,
      "Documents Ratio": docEval.ratio,
      "Missing Documents Count": docEval.missingCount,
      "All Missing Fields / Documents": docEval.missingAll,
      "Verified Documents": docEval.verifiedAll,
      "Is Approved": s.isApproved ? "Yes" : "No",
      "Is Suspended": s.isSuspended ? "Yes" : "No",
      "Onboarding Complete": s.onboardingCompleted ? "Yes" : "No",
      "Onboarding Step": s.onboardingCompleted ? "Completed (6/6)" : `Step ${s.onboardingStep ?? 1}/6`,
      "Subscription Plan": toSafeString(s.subscription?.plan?.displayName || s.subscription?.plan?.name || "Free"),
      "Commission Rate (%)": `${toSafeString(s.commissionRate ?? s.baseCommissionRate ?? 10)}%`,
      "Total Items Count": toSafeString(itemsCount),
      "Total Orders": toSafeString(s._count?.orders ?? 0),
      "Business Reg Number": toSafeString(busInfo.businessRegNumber),
      "Business Reg Doc URL": toSafeString(busInfo.busRegCertUrl),
      "Tax ID / TIN": toSafeString(busInfo.taxIdNumber),
      "ID Type": toSafeString(kyc.idType),
      "ID Number": toSafeString(kyc.idNumber),
      "ID Front URL": toSafeString(kyc.idFrontUrl),
      "ID Back URL": toSafeString(kyc.idBackUrl),
      "Selfie with ID URL": toSafeString(kyc.selfieUrl),
      "Bank Name": toSafeString(bank.bankName),
      "Bank Account Name": toSafeString(bank.accountName),
      "Bank Account Number": toSafeString(bank.accountNumber),
      "Bank Routing / Swift": toSafeString(bank.routingNumber),
      "Bank Branch": toSafeString(bank.branchName),
      "Bank Passbook / Cheque URL": toSafeString(bank.passbookUrl),
      "Referral Source": toSafeString(agree.hearAboutUs),
      "Admin Feedback": toSafeString(s.adminFeedback),
      "Registered Date": toSafeString(s.createdAt),
      "Updated Date": toSafeString(s.updatedAt),
    }
  })

  await exportRowsToExcel(filename, "Product & Service Sellers", rows)
}

/**
 * 3. Export Hotel Sellers
 */
export async function exportHotelSellersToExcel(sellers: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `hotel_sellers_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = sellers.map((h, idx) => {
    const user = h.user || {}
    const busInfo = h.businessInfo || {}
    const kyc = h.kyc || {}
    const bank = h.bankDetails || {}
    const agree = h.agreement || {}
    const docEval = formatDocStatus(h.documentEvaluation)
    const firstHotel = Array.isArray(h.hotels) && h.hotels.length > 0 ? h.hotels[0] : {}

    return {
      "SL No": String(idx + 1),
      "Seller ID": toSafeString(h.id),
      "Seller Type": "Hotel Seller",
      "Property / Hotel Name": toSafeString(firstHotel.name || busInfo.businessName),
      "Total Properties": toSafeString(h.hotels?.length ?? 0),
      "Contact Person": toSafeString(user.name || busInfo.pocName),
      "Email Address": toSafeString(user.email),
      "Phone Number": formatPhone(user.phoneCountryCode, user.phone || busInfo.pocContact),
      "POC Name": toSafeString(busInfo.pocName),
      "POC Contact": toSafeString(busInfo.pocContact),
      "City": toSafeString(busInfo.city || firstHotel.city),
      "State": toSafeString(busInfo.state || firstHotel.state),
      "Full Address": toSafeString(busInfo.address || firstHotel.address),
      "Account Status": formatSellerStatus(h),
      "Document Status Badge": docEval.badge,
      "Document Compliance": docEval.status,
      "Documents Ratio": docEval.ratio,
      "Missing Documents Count": docEval.missingCount,
      "All Missing Fields / Documents": docEval.missingAll,
      "Verified Documents": docEval.verifiedAll,
      "Is Approved": h.isApproved ? "Yes" : "No",
      "Is Suspended": h.isSuspended ? "Yes" : "No",
      "Onboarding Complete": h.onboardingCompleted ? "Yes" : "No",
      "Onboarding Step": h.onboardingCompleted ? "Completed (6/6)" : `Step ${h.onboardingStep ?? 1}/6`,
      "Subscription Plan": toSafeString(h.subscription?.plan?.displayName || h.subscription?.plan?.name || "Free"),
      "Commission Rate (%)": `${toSafeString(h.commissionRate ?? h.baseCommissionRate ?? 10)}%`,
      "Business Reg Number": toSafeString(busInfo.businessRegNumber),
      "Business Reg Doc URL": toSafeString(busInfo.busRegCertUrl),
      "Tax ID / TIN": toSafeString(busInfo.taxIdNumber),
      "ID Type": toSafeString(kyc.idType),
      "ID Number": toSafeString(kyc.idNumber),
      "ID Front URL": toSafeString(kyc.idFrontUrl),
      "ID Back URL": toSafeString(kyc.idBackUrl),
      "Selfie with ID URL": toSafeString(kyc.selfieUrl),
      "Bank Name": toSafeString(bank.bankName),
      "Bank Account Name": toSafeString(bank.accountName),
      "Bank Account Number": toSafeString(bank.accountNumber),
      "Bank Routing / Swift": toSafeString(bank.routingNumber),
      "Bank Branch": toSafeString(bank.branchName),
      "Bank Passbook / Cheque URL": toSafeString(bank.passbookUrl),
      "Referral Source": toSafeString(agree.hearAboutUs),
      "Admin Feedback": toSafeString(h.adminFeedback),
      "Registered Date": toSafeString(h.createdAt),
      "Updated Date": toSafeString(h.updatedAt),
    }
  })

  await exportRowsToExcel(filename, "Hotel Sellers", rows)
}

/**
 * 4. Export Restaurant Sellers
 */
export async function exportRestaurantSellersToExcel(sellers: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `restaurant_sellers_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = sellers.map((r, idx) => {
    const user = r.user || {}
    const busInfo = r.businessInfo || {}
    const kyc = r.kyc || {}
    const bank = r.bankDetails || {}
    const agree = r.agreement || {}
    const docEval = formatDocStatus(r.documentEvaluation)

    return {
      "SL No": String(idx + 1),
      "Seller ID": toSafeString(r.id),
      "Seller Type": "Restaurant Seller",
      "Restaurant / Business Name": toSafeString(busInfo.businessName),
      "Contact Person": toSafeString(user.name || busInfo.pocName),
      "Email Address": toSafeString(user.email),
      "Phone Number": formatPhone(user.phoneCountryCode, user.phone || busInfo.pocContact),
      "POC Name": toSafeString(busInfo.pocName),
      "POC Contact": toSafeString(busInfo.pocContact),
      "City": toSafeString(busInfo.city),
      "State": toSafeString(busInfo.state),
      "Landmark": toSafeString(busInfo.landmark),
      "Full Address": toSafeString(busInfo.address),
      "Account Status": formatSellerStatus(r),
      "Document Status Badge": docEval.badge,
      "Document Compliance": docEval.status,
      "Documents Ratio": docEval.ratio,
      "Missing Documents Count": docEval.missingCount,
      "All Missing Fields / Documents": docEval.missingAll,
      "Verified Documents": docEval.verifiedAll,
      "Is Approved": r.isApproved ? "Yes" : "No",
      "Is Suspended": r.isSuspended ? "Yes" : "No",
      "Onboarding Complete": r.onboardingCompleted ? "Yes" : "No",
      "Onboarding Step": r.onboardingCompleted ? "Completed (6/6)" : `Step ${r.onboardingStep ?? 1}/6`,
      "Subscription Plan": toSafeString(r.subscription?.plan?.displayName || r.subscription?.plan?.name || "Free"),
      "Commission Rate (%)": `${toSafeString(r.commissionRate ?? r.baseCommissionRate ?? 10)}%`,
      "Total Menu Items": toSafeString(r.foods?.length ?? 0),
      "Total Orders": toSafeString(r.foodOrders?.length ?? 0),
      "Food License / FSSAI": toSafeString(kyc.foodLicenseNumber),
      "Food License Doc URL": toSafeString(kyc.foodLicenseUrl),
      "Business Reg Number": toSafeString(busInfo.businessRegNumber),
      "Business Reg Doc URL": toSafeString(busInfo.busRegCertUrl),
      "Tax ID / TIN": toSafeString(busInfo.taxIdNumber),
      "ID Type": toSafeString(kyc.idType),
      "ID Number": toSafeString(kyc.idNumber),
      "ID Front URL": toSafeString(kyc.idFrontUrl),
      "ID Back URL": toSafeString(kyc.idBackUrl),
      "Selfie with ID URL": toSafeString(kyc.selfieUrl),
      "Bank Name": toSafeString(bank.bankName),
      "Bank Account Name": toSafeString(bank.accountName),
      "Bank Account Number": toSafeString(bank.accountNumber),
      "Bank Routing / Swift": toSafeString(bank.routingNumber),
      "Bank Branch": toSafeString(bank.branchName),
      "Bank Passbook / Cheque URL": toSafeString(bank.passbookUrl),
      "Referral Source": toSafeString(agree.hearAboutUs),
      "Admin Feedback": toSafeString(r.adminFeedback),
      "Registered Date": toSafeString(r.createdAt),
      "Updated Date": toSafeString(r.updatedAt),
    }
  })

  await exportRowsToExcel(filename, "Restaurant Sellers", rows)
}

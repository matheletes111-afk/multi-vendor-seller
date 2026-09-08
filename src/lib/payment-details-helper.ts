/**
 * Helper utility to resolve, validate, and normalize seller bank and mobile money payment options.
 * Supported Payment Options:
 * - "Bank"
 * - "Orange Money"
 * - "AfriMoney"
 */

export interface ParsedPaymentDetails {
  paymentOption: "Bank" | "Orange Money" | "AfriMoney"
  preferredPayoutMethod: "Bank Transfer" | "Mobile Wallet"
  mobileMoneyOption: string | null
  mobileNumber: string | null
  agentNumber: string | null
  bankName: string | null
  bankAddress: string | null
  accountHolderName: string | null
  accountNumber: string | null
  bbanNumber: string | null
  branchName: string | null
  passbookUrl?: string | null
  bankLetterUrl?: string | null
}

export function resolvePaymentOption(
  rawOption?: string | null,
  rawMethod?: string | null,
  rawMobileOption?: string | null,
  hasMobileNumbers?: boolean
): "Bank" | "Orange Money" | "AfriMoney" {
  const opt = (rawOption || "").trim().toLowerCase()
  if (opt.includes("orange")) return "Orange Money"
  if (opt.includes("afri")) return "AfriMoney"
  if (opt.includes("bank")) return "Bank"

  // Backward compatibility fallback for older mobile apps / existing records:
  const method = (rawMethod || "").trim().toLowerCase()
  const mobOpt = (rawMobileOption || "").trim().toLowerCase()
  if (method.includes("mobile") || method.includes("wallet") || mobOpt || hasMobileNumbers) {
    if (mobOpt.includes("afri")) return "AfriMoney"
    return "Orange Money"
  }

  return "Bank"
}

export function validateAndFormatPaymentDetails(
  input: {
    paymentOption?: string | null
    preferredPayoutMethod?: string | null
    mobileMoneyOption?: string | null
    mobileNumber?: string | null
    agentNumber?: string | null
    bankName?: string | null
    bankAddress?: string | null
    accountHolderName?: string | null
    accountNumber?: string | null
    bbanNumber?: string | null
    branchName?: string | null
    passbookUrl?: string | null
    bankLetterUrl?: string | null
  },
  options: { requireFields?: boolean } = { requireFields: true }
): { data: ParsedPaymentDetails; error?: string } {
  const mobileNumber = input.mobileNumber ? input.mobileNumber.trim() : null
  const agentNumber = input.agentNumber ? input.agentNumber.trim() : null
  const hasMobileNumbers = !!(mobileNumber || agentNumber)

  const paymentOption = resolvePaymentOption(
    input.paymentOption,
    input.preferredPayoutMethod,
    input.mobileMoneyOption,
    hasMobileNumbers
  )

  if (paymentOption === "Orange Money" || paymentOption === "AfriMoney") {
    if (options.requireFields) {
      if (!mobileNumber) {
        return {
          data: {} as any,
          error: `Mobile Number is required for ${paymentOption}.`,
        }
      }
      if (!agentNumber) {
        return {
          data: {} as any,
          error: `Agent Number is required for ${paymentOption}.`,
        }
      }
    }

    return {
      data: {
        paymentOption,
        preferredPayoutMethod: "Mobile Wallet",
        mobileMoneyOption: paymentOption,
        mobileNumber,
        agentNumber,
        // All bank data becomes null when mobile money is selected
        bankName: null,
        bankAddress: null,
        accountHolderName: null,
        accountNumber: null,
        bbanNumber: null,
        branchName: null,
        passbookUrl: null,
        bankLetterUrl: null,
      },
    }
  }

  // Otherwise: Bank
  const bankName = input.bankName ? input.bankName.trim() : null
  const bankAddress = input.bankAddress ? input.bankAddress.trim() : null
  const accountHolderName = input.accountHolderName ? input.accountHolderName.trim() : null
  const accountNumber = input.accountNumber ? input.accountNumber.trim() : null
  const bbanNumber = input.bbanNumber ? input.bbanNumber.trim() : null
  const branchName = input.branchName ? input.branchName.trim() : null

  if (options.requireFields) {
    if (!bankName) return { data: {} as any, error: "Bank Name is required." }
    if (!accountHolderName) return { data: {} as any, error: "Account Holder Name is required." }
    if (!accountNumber) return { data: {} as any, error: "Account Number is required." }
    if (!bbanNumber) return { data: {} as any, error: "BBAN Number is required." }
    if (!branchName) return { data: {} as any, error: "Branch Name is required." }
    if (!bankAddress) return { data: {} as any, error: "Bank Address is required." }
  }

  return {
    data: {
      paymentOption: "Bank",
      preferredPayoutMethod: "Bank Transfer",
      mobileMoneyOption: null,
      mobileNumber: null,
      agentNumber: null,
      bankName,
      bankAddress,
      accountHolderName,
      accountNumber,
      bbanNumber,
      branchName,
      passbookUrl: input.passbookUrl || null,
      bankLetterUrl: input.bankLetterUrl || null,
    },
  }
}

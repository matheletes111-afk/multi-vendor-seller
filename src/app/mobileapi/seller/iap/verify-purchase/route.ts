import { NextRequest } from "next/server"
import { handleVerifyPurchase } from "@/lib/ApplePay"

export async function POST(request: NextRequest) {
  return handleVerifyPurchase(request)
}

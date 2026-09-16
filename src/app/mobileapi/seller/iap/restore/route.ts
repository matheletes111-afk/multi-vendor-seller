import { NextRequest } from "next/server"
import { handleRestorePurchase } from "@/lib/ApplePay"

export async function POST(request: NextRequest) {
  return handleRestorePurchase(request)
}

import { NextRequest } from "next/server"
import { handleAppleWebhook } from "@/lib/ApplePay"

export async function POST(request: NextRequest) {
  return handleAppleWebhook(request)
}

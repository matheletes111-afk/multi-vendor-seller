import { NextResponse } from "next/server"
import { BUYER_TERMS_DOC } from "@/lib/terms-data"

/**
 * GET /mobileapi/terms-and-conditions
 * Returns the exact full Buyer Terms and Conditions extracted from terms docx.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    title: BUYER_TERMS_DOC.title,
    lastUpdated: BUYER_TERMS_DOC.lastUpdated,
    content: BUYER_TERMS_DOC.content,
    rawText: BUYER_TERMS_DOC.rawText,
  })
}

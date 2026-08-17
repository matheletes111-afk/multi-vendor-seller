import { NextResponse } from "next/server"
import { FOOTER_PRIVACY_DOC } from "@/lib/terms-data"

export async function GET() {
  return NextResponse.json({
    success: true,
    title: FOOTER_PRIVACY_DOC.title,
    lastUpdated: FOOTER_PRIVACY_DOC.lastUpdated,
    content: FOOTER_PRIVACY_DOC.content,
    rawText: FOOTER_PRIVACY_DOC.rawText,
  })
}

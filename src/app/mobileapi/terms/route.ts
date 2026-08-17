import { NextResponse } from "next/server"
import { FOOTER_TERMS_DOC } from "@/lib/terms-data"

export async function GET() {
  return NextResponse.json({
    success: true,
    title: FOOTER_TERMS_DOC.title,
    lastUpdated: FOOTER_TERMS_DOC.lastUpdated,
    content: FOOTER_TERMS_DOC.content,
    rawText: FOOTER_TERMS_DOC.rawText,
  })
}

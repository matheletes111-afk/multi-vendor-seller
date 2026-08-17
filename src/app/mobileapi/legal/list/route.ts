import { NextResponse } from "next/server"
import { LEGAL_DOCUMENTS } from "@/lib/terms-data"

/**
 * GET /mobileapi/legal/list
 * Returns a catalog list of all 10 legal and policy documents available in the system.
 */
export async function GET() {
  const documents = LEGAL_DOCUMENTS.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    source: doc.source,
    lastUpdated: doc.lastUpdated,
    endpoint: `/mobileapi/legal/${doc.slug}`,
  }))

  return NextResponse.json({
    success: true,
    total: documents.length,
    documents,
  })
}

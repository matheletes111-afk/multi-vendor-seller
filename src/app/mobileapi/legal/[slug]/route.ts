import { NextRequest, NextResponse } from "next/server"
import { LEGAL_DOCS_BY_SLUG, LEGAL_DOCUMENTS } from "@/lib/terms-data"

/**
 * GET /mobileapi/legal/[slug]
 * Dynamic mobile API returning any of the 10 legal policy documents by slug.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } }
) {
  const params = await Promise.resolve(context.params)
  const slug = (params.slug || "").toLowerCase().trim()

  const doc = LEGAL_DOCS_BY_SLUG[slug]
  if (!doc) {
    return NextResponse.json(
      {
        success: false,
        error: `Document '${slug}' not found.`,
        availableSlugs: LEGAL_DOCUMENTS.map((d) => d.slug),
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    source: doc.source,
    lastUpdated: doc.lastUpdated,
    content: doc.content,
    rawText: doc.rawText,
  })
}

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

  // If terms and conditions, dynamically hydrate live category base commission rates
  if (slug === "terms-and-conditions" || slug === "terms" || slug === "footer-terms") {
    try {
      const { prisma } = await import("@/lib/prisma")
      const { getDynamicTermsAndConditionsDoc } = await import("@/lib/terms-data")
      const globalSetting = await (prisma as any).globalSetting.findFirst()

      const productBaseCommission = Number(
        globalSetting?.productBaseCommission ?? globalSetting?.baseCommission ?? 10.0
      )
      const restaurantBaseCommission = Number(
        globalSetting?.restaurantBaseCommission ?? globalSetting?.baseCommission ?? 10.0
      )
      const hotelBaseCommission = Number(
        globalSetting?.hotelBaseCommission ?? globalSetting?.baseCommission ?? 10.0
      )
      const serviceBaseCommission = Number(
        globalSetting?.serviceBaseCommission ?? globalSetting?.baseCommission ?? 10.0
      )

      const dynamicDoc = getDynamicTermsAndConditionsDoc({
        productBaseCommission,
        restaurantBaseCommission,
        hotelBaseCommission,
        serviceBaseCommission,
      })

      return NextResponse.json({
        success: true,
        id: dynamicDoc.id,
        slug: dynamicDoc.slug,
        title: dynamicDoc.title,
        source: dynamicDoc.source,
        lastUpdated: dynamicDoc.lastUpdated,
        baseCommissions: {
          product: productBaseCommission,
          restaurant: restaurantBaseCommission,
          hotel: hotelBaseCommission,
          service: serviceBaseCommission,
        },
        content: dynamicDoc.content,
        rawText: dynamicDoc.rawText,
      })
    } catch (e) {
      console.error("Failed to dynamically hydrate legal doc:", e)
    }
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

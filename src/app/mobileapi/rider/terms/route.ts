import { NextRequest, NextResponse } from "next/server"
import {
  RIDER_TERMS_AND_CONDITIONS,
  RIDER_PRIVACY_POLICY,
  getRiderLegalDocument,
} from "@/lib/rider-terms-data"

/**
 * GET /mobileapi/rider/terms
 * 
 * Mobile API endpoint for delivery app developers.
 * Provides delivery partner Terms & Conditions and Privacy Policy in structured format.
 * 
 * Query Params:
 *  - type=terms | privacy | all (default: all)
 *  - tab=terms | privacy (alias)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const typeParam = (searchParams.get("type") || searchParams.get("tab") || "all").toLowerCase().trim()

    if (typeParam === "terms" || typeParam === "terms-and-conditions" || typeParam === "terms-conditions") {
      return NextResponse.json({
        success: true,
        documentType: "terms",
        data: RIDER_TERMS_AND_CONDITIONS,
      })
    }

    if (typeParam === "privacy" || typeParam === "privacy-policy") {
      return NextResponse.json({
        success: true,
        documentType: "privacy",
        data: RIDER_PRIVACY_POLICY,
      })
    }

    // Default: Return both documents
    const allDocs = getRiderLegalDocument("all")
    return NextResponse.json({
      success: true,
      documentType: "all",
      data: allDocs,
    })
  } catch (error) {
    console.error("Error fetching rider legal documents:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve rider legal documents",
      },
      { status: 500 }
    )
  }
}

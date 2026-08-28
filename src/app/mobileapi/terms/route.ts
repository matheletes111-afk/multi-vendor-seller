import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDynamicTermsAndConditionsDoc } from "@/lib/terms-data"

export async function GET() {
  try {
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

    const doc = getDynamicTermsAndConditionsDoc({
      productBaseCommission,
      restaurantBaseCommission,
      hotelBaseCommission,
      serviceBaseCommission,
    })

    return NextResponse.json({
      success: true,
      title: doc.title,
      lastUpdated: doc.lastUpdated,
      baseCommissions: {
        product: productBaseCommission,
        restaurant: restaurantBaseCommission,
        hotel: hotelBaseCommission,
        service: serviceBaseCommission,
      },
      content: doc.content,
      rawText: doc.rawText,
    })
  } catch (error) {
    console.error("Failed to load terms:", error)
    const fallbackDoc = getDynamicTermsAndConditionsDoc()
    return NextResponse.json({
      success: true,
      title: fallbackDoc.title,
      lastUpdated: fallbackDoc.lastUpdated,
      baseCommissions: {
        product: 10.0,
        restaurant: 10.0,
        hotel: 10.0,
        service: 10.0,
      },
      content: fallbackDoc.content,
      rawText: fallbackDoc.rawText,
    })
  }
}

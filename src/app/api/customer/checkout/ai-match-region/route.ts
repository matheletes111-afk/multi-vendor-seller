import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { matchRegionWithAI, AddressInput } from "@/lib/ai-region-matcher"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AddressInput
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid address input payload" }, { status: 400 })
    }

    const aiResult = await matchRegionWithAI(body)

    // Fetch delivery charge for matchedRegion from globalSetting
    let regionCharge = 0
    const globalSettings = await (prisma as any).globalSetting.findFirst()
    if (globalSettings?.regionDeliveryCharges && Array.isArray(globalSettings.regionDeliveryCharges)) {
      const match = globalSettings.regionDeliveryCharges.find(
        (rc: any) => String(rc.region).trim().toUpperCase() === aiResult.matchedRegion.toUpperCase()
      )
      if (match) {
        regionCharge = parseFloat(match.charge) || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...aiResult,
        charge: regionCharge,
      },
    })
  } catch (error: any) {
    console.error("[API AI Match Region Error]:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process AI region matching",
      },
      { status: 500 }
    )
  }
}

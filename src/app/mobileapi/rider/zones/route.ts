import { NextResponse } from "next/server"
import { LOCATION_ZONES } from "@/lib/location-zones"

// GET /mobileapi/rider/zones — Returns hierarchical delivery zones & locations
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: {
        zones: LOCATION_ZONES,
        totalZones: LOCATION_ZONES.length,
        totalLocations: LOCATION_ZONES.reduce((acc, z) => acc + z.regions.length, 0),
      },
    })
  } catch (error) {
    console.error("Mobile rider zones GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch delivery zones." },
      { status: 500 }
    )
  }
}

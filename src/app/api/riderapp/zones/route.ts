import { NextResponse } from "next/server"
import { LOCATION_ZONES } from "@/lib/location-zones"

export async function GET() {
  return NextResponse.json({
    success: true,
    zones: LOCATION_ZONES,
    totalZones: LOCATION_ZONES.length,
    totalLocations: LOCATION_ZONES.reduce((acc, z) => acc + z.regions.length, 0),
  })
}

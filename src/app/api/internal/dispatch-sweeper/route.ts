import { NextRequest, NextResponse } from "next/server"
import { processStaleAssignmentsAndNoShows } from "@/lib/delivery-dispatch"

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("x-internal-secret")
    const envSecret = process.env.INTERNAL_API_SECRET

    if (envSecret && secret !== envSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await processStaleAssignmentsAndNoShows()

    return NextResponse.json({
      success: true,
      message: "Dispatch sweeper executed successfully",
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[Sweeper API] Error running dispatch sweeper:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to execute sweeper" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}

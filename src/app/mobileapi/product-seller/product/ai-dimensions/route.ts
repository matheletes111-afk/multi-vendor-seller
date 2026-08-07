import { NextRequest } from "next/server"
import { GET as handleGet, POST as handlePost } from "../ai-dimensions/route"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return handleGet(request)
}

export async function POST(request: NextRequest) {
  return handlePost(request)
}

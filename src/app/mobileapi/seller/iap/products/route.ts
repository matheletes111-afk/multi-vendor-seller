import { NextRequest } from "next/server"
import { handleGetProducts } from "@/lib/ApplePay"

export async function GET(request: NextRequest) {
  return handleGetProducts(request)
}

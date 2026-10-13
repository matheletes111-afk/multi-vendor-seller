import { NextResponse, NextRequest } from "next/server"
import { GET as nextAuthGet } from "@/app/api/nextauth/[...nextauth]/route"

/**
 * GET /api/auth/csrf
 * Proxies to NextAuth handler at /api/nextauth/csrf so standard client-side
 * next-auth/react methods (e.g. getCsrfToken) receive a valid CSRF token and cookie.
 */
export async function GET(request: NextRequest) {
  try {
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (request.url.startsWith("https") ? "https" : "http")
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      new URL(request.url).host
    const origin = `${proto}://${host}`
    const cookie = request.headers.get("cookie") ?? ""

    const csrfReq = new NextRequest(`${origin}/api/nextauth/csrf`, {
      headers: {
        Host: host,
        "x-forwarded-proto": proto,
        "x-forwarded-host": host,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    })

    const res = await nextAuthGet(csrfReq as any)
    const data = await res.json().catch(() => ({}))

    const headers = new Headers()
    const setCookies =
      typeof (res.headers as any)?.getSetCookie === "function"
        ? (res.headers as any).getSetCookie()
        : [res.headers.get("set-cookie")].filter(Boolean)
    if (Array.isArray(setCookies)) {
      setCookies.forEach((c: string) => headers.append("Set-Cookie", c))
    }

    return NextResponse.json(data, { status: res.status, headers })
  } catch (error) {
    console.error("Error in /api/auth/csrf proxy:", error)
    return NextResponse.json({ error: "Failed to get CSRF token" }, { status: 500 })
  }
}

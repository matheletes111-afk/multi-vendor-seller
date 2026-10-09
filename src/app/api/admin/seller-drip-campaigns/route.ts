import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin, isSuperAdmin, canAccessModule } from "@/lib/rbac"
import { DEFAULT_DRIP_TEMPLATES, getDefaultDripTemplate } from "@/lib/seller-drip-defaults"
import { sendSellerDripEmail } from "@/lib/email"

function isUserAuthorized(user: any): boolean {
  if (!user) return false
  if (isSuperAdmin(user) || isAdmin(user)) return true
  return canAccessModule(user, "seller-drip-campaigns")
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isUserAuthorized(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. Fetch all customized templates from DB
    const dbTemplates = await prisma.sellerDripTemplate.findMany({
      orderBy: [{ sellerType: "asc" }, { dayNumber: "asc" }],
    })

    const dbMap = new Map<string, any>()
    for (const t of dbTemplates) {
      dbMap.set(`${t.sellerType}_${t.dayNumber}`, t)
    }

    // 2. Merge all 28 default templates with any DB overrides
    const sellerTypes = ["PRODUCT", "SERVICE", "HOTEL", "RESTAURANT"] as const
    const fullTemplates: any[] = []

    for (const st of sellerTypes) {
      for (let day = 1; day <= 7; day++) {
        const key = `${st}_${day}`
        const dbRecord = dbMap.get(key)
        const def = getDefaultDripTemplate(st, day)

        if (dbRecord) {
          fullTemplates.push({
            id: dbRecord.id,
            sellerType: st,
            dayNumber: day,
            subject: dbRecord.subject,
            preheader: dbRecord.preheader,
            headline: dbRecord.headline,
            body: dbRecord.body,
            bulletPoints: Array.isArray(dbRecord.bulletPoints)
              ? dbRecord.bulletPoints
              : def.bulletPoints,
            ctaText: dbRecord.ctaText,
            ctaUrl: dbRecord.ctaUrl,
            isActive: dbRecord.isActive,
            isCustomized: true,
            updatedAt: dbRecord.updatedAt,
          })
        } else {
          fullTemplates.push({
            id: `default_${st}_${day}`,
            sellerType: st,
            dayNumber: day,
            subject: def.subject,
            preheader: def.preheader,
            headline: def.headline,
            body: def.body,
            bulletPoints: def.bulletPoints,
            ctaText: def.ctaText,
            ctaUrl: def.ctaUrl,
            isActive: true,
            isCustomized: false,
            updatedAt: null,
          })
        }
      }
    }

    // 3. Overall Stats
    const [totalSentLogs, totalActiveSellers, recentLogs] = await Promise.all([
      prisma.sellerDripLog.count({ where: { status: "SENT" } }),
      prisma.seller.count({
        where: { onboardingCompleted: true, isApproved: true, isSuspended: false },
      }),
      prisma.sellerDripLog.findMany({
        take: 10,
        orderBy: { sentAt: "desc" },
      }),
    ])

    return NextResponse.json({
      success: true,
      templates: fullTemplates,
      stats: {
        totalTemplates: 28,
        customizedCount: dbTemplates.length,
        defaultCount: 28 - dbTemplates.length,
        totalSentLogs,
        totalActiveSellers,
      },
      recentLogs,
    })
  } catch (error: any) {
    console.error("[Admin API: Seller Drip Campaigns] GET Error:", error)
    return NextResponse.json({ error: error?.message || "Failed to load drip campaigns" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isUserAuthorized(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action = "save", sellerType, dayNumber } = body

    if (!sellerType || !dayNumber) {
      return NextResponse.json({ error: "sellerType and dayNumber are required" }, { status: 400 })
    }

    const normalizedType = String(sellerType).toUpperCase()
    const safeDay = Math.min(Math.max(Number(dayNumber) || 1, 1), 7)

    // Action 1: Send Test Email
    if (action === "test-email") {
      const recipientEmail = body.testEmail?.trim() || session.user.email
      if (!recipientEmail) {
        return NextResponse.json({ error: "Recipient email is required for test send" }, { status: 400 })
      }

      const subject = body.subject || "MEEEM Test Drip Email"
      const headline = body.headline || "Test Headline"
      const messageBody = body.body || "This is a preview test email from MEEEM Admin Panel."
      const bulletPoints = Array.isArray(body.bulletPoints) ? body.bulletPoints : []
      const ctaText = body.ctaText || "Get Started"
      const ctaUrl = body.ctaUrl || "/product-seller/dashboard"

      const result = await sendSellerDripEmail({
        to: recipientEmail,
        sellerName: session.user.name || "Admin Previewer",
        businessName: "Demo Store",
        sellerType: normalizedType,
        dayNumber: safeDay,
        subject: `[TEST PREVIEW] ${subject}`,
        preheader: body.preheader,
        headline,
        body: messageBody,
        bulletPoints,
        ctaText,
        ctaUrl,
      })

      if (result.success) {
        return NextResponse.json({ success: true, message: `Test email sent to ${recipientEmail}` })
      } else {
        const errMsg = ("error" in result && (result.error as any)?.message) || "Failed to deliver test email"
        return NextResponse.json({ error: errMsg }, { status: 500 })
      }
    }

    // Action 2: Reset to Default
    if (action === "reset-default") {
      await prisma.sellerDripTemplate.deleteMany({
        where: {
          sellerType: normalizedType,
          dayNumber: safeDay,
        },
      })
      const def = getDefaultDripTemplate(normalizedType as any, safeDay)
      return NextResponse.json({
        success: true,
        message: `Template for ${normalizedType} Day ${safeDay} reset to system default.`,
        template: {
          ...def,
          isCustomized: false,
        },
      })
    }

    // Action 3: Save / Update Custom Template
    const {
      subject,
      preheader,
      headline,
      body: contentBody,
      bulletPoints = [],
      ctaText,
      ctaUrl,
      isActive = true,
    } = body

    if (!subject?.trim() || !headline?.trim() || !contentBody?.trim()) {
      return NextResponse.json({ error: "Subject, Headline, and Message Body are required" }, { status: 400 })
    }

    const cleanBullets = Array.isArray(bulletPoints)
      ? bulletPoints.map((b) => String(b).trim()).filter(Boolean)
      : []

    const saved = await prisma.sellerDripTemplate.upsert({
      where: {
        sellerType_dayNumber: {
          sellerType: normalizedType,
          dayNumber: safeDay,
        },
      },
      update: {
        subject: subject.trim(),
        preheader: preheader?.trim() || null,
        headline: headline.trim(),
        body: contentBody.trim(),
        bulletPoints: cleanBullets,
        ctaText: ctaText?.trim() || "Get Started",
        ctaUrl: ctaUrl?.trim() || `/${normalizedType.toLowerCase()}-seller/dashboard`,
        isActive: Boolean(isActive),
      },
      create: {
        sellerType: normalizedType,
        dayNumber: safeDay,
        subject: subject.trim(),
        preheader: preheader?.trim() || null,
        headline: headline.trim(),
        body: contentBody.trim(),
        bulletPoints: cleanBullets,
        ctaText: ctaText?.trim() || "Get Started",
        ctaUrl: ctaUrl?.trim() || `/${normalizedType.toLowerCase()}-seller/dashboard`,
        isActive: Boolean(isActive),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Template for ${normalizedType} Day ${safeDay} updated successfully.`,
      template: {
        ...saved,
        isCustomized: true,
      },
    })
  } catch (error: any) {
    console.error("[Admin API: Seller Drip Campaigns] POST Error:", error)
    return NextResponse.json({ error: error?.message || "Failed to update template" }, { status: 500 })
  }
}

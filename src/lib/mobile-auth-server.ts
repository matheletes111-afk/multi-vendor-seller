import { NextRequest, NextResponse } from "next/server";
import { verifyMobileAccessToken, MobileTokenPayload } from "./mobile-jwt";
import { prisma } from "./prisma";
import { UserRole } from "@prisma/client";

export type MobileAuthResult =
  | { success: true; user: { id: string; email: string; role: UserRole; name?: string | null; phone?: string | null; phoneCountryCode?: string | null; image?: string | null }; seller: any }
  | { success: false; errorResponse: NextResponse };

/**
 * Utility to verify mobile Bearer JWT in route handlers.
 * Returns the authenticated user and their seller record.
 */
export async function verifyMobileAuth(
  request: NextRequest,
  requiredRole?: UserRole
): Promise<MobileAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: "Missing or invalid authorization header" },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7);
  const decoded = verifyMobileAccessToken(token);

  if (!decoded || !decoded.userId) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: "Unauthorized or expired token" },
        { status: 401 }
      ),
    };
  }

  if (requiredRole && decoded.role !== requiredRole) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      seller: {
        include: {
          businessInfo: true,
          kyc: true,
          bankDetails: true,
          store: true,
          selectedCategories: true,
          selectedServiceCategories: true,
          agreement: true,
        },
      },
    },
  });

  if (!user || !user.seller) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: "User or seller account not found" },
        { status: 404 }
      ),
    };
  }

  return {
    success: true,
    user: { 
      id: user.id, 
      email: user.email, 
      role: user.role as UserRole,
      name: user.name,
      phone: user.phone,
      phoneCountryCode: user.phoneCountryCode,
      image: user.image
    },
    seller: user.seller,
  };
}

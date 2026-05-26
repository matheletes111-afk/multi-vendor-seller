import { NextRequest, NextResponse } from "next/server";
import { verifyMobileAccessToken } from "./mobile-jwt";
import { prisma } from "./prisma";
import { UserRole } from "@prisma/client";

export type MobileHotelRestaurantAuthResult =
  | { 
      success: true; 
      user: { 
        id: string; 
        email: string; 
        role: UserRole; 
        name?: string | null; 
        phone?: string | null; 
        phoneCountryCode?: string | null; 
        image?: string | null 
      }; 
      seller: any;
    }
  | { success: false; errorResponse: NextResponse };

/**
 * Utility to verify mobile Bearer JWT for Hotel/Restaurant sellers in route handlers.
 * Returns the authenticated user and their specific seller record (hotelSeller or restaurantSeller).
 */
export async function verifyMobileHotelRestaurantAuth(
  request: NextRequest,
  requiredRole?: UserRole
): Promise<MobileHotelRestaurantAuthResult> {
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

  const targetRole = decoded.role as UserRole;
  if (requiredRole && targetRole !== requiredRole) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 }
      ),
    };
  }

  if (targetRole !== UserRole.SELLER_HOTEL && targetRole !== UserRole.SELLER_RESTAURANT) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: "Forbidden: Invalid seller type" },
        { status: 403 }
      ),
    };
  }

  // Find user and include the correct role-based seller profile
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      restaurantSeller: {
        include: {
          businessInfo: true,
          kyc: true,
          bankDetails: true,
          agreement: true,
        },
      },
      hotelSeller: {
        include: {
          businessInfo: true,
          kyc: true,
          bankDetails: true,
          agreement: true,
        },
      },
    },
  });

  if (!user) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: "User account not found" },
        { status: 404 }
      ),
    };
  }

  let sellerRecord = null;
  if (targetRole === UserRole.SELLER_RESTAURANT) {
    sellerRecord = user.restaurantSeller;
  } else if (targetRole === UserRole.SELLER_HOTEL) {
    sellerRecord = user.hotelSeller;
  }

  if (!sellerRecord) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: "Seller account profile not found" },
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
      image: user.image,
    },
    seller: sellerRecord,
  };
}

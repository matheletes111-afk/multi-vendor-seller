import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { getPaginationFromSearchParams } from "@/lib/admin-pagination";
import type { Prisma } from "@prisma/client";
import { getPresignedUrlOrOriginal } from "@/lib/s3-presigned";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    });

    const search = searchParams.get("search")?.trim();
    const hotelSellerId = searchParams.get("hotelSellerId")?.trim();
    const status = searchParams.get("status")?.trim(); // "active", "inactive", "all"

    let where: Prisma.HotelWhereInput = {
      isDeleted: false,
    };

    if (hotelSellerId && hotelSellerId !== "all") {
      where.hotelSellerId = hotelSellerId;
    }

    if (status && status !== "all") {
      where.isActive = status === "active";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
      ];
    }

    const [hotels, totalCount, hotelSellers] = await Promise.all([
      prisma.hotel.findMany({
        where,
        skip,
        take,
        include: {
          hotelSeller: {
            include: {
              businessInfo: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              rooms: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hotel.count({ where }),
      prisma.hotelSeller.findMany({
        include: {
          businessInfo: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    // Pre-sign URLs for each hotel
    const preSignedHotels = await Promise.all(
      hotels.map(async (hotel) => {
        hotel.logo = await getPresignedUrlOrOriginal(hotel.logo);
        hotel.banner = await getPresignedUrlOrOriginal(hotel.banner);
        let parsedImages = [];
        try {
          parsedImages = typeof hotel.images === 'string' ? JSON.parse(hotel.images) : hotel.images;
        } catch (e) {}
        if (Array.isArray(parsedImages)) {
          hotel.images = await Promise.all(parsedImages.map(img => getPresignedUrlOrOriginal(img)));
        }
        return hotel;
      })
    );

    const totalPages = Math.ceil(totalCount / perPage);

    return NextResponse.json({
      hotels: preSignedHotels,
      hotelSellers,
      totalCount,
      totalPages,
      page,
      perPage,
    });
  } catch (error) {
    console.error("Error fetching admin hotels:", error);
    return NextResponse.json(
      { error: "Failed to fetch hotels" },
      { status: 500 }
    );
  }
}

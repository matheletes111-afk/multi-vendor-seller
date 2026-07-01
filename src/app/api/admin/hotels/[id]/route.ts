import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { getPresignedUrlOrOriginal } from "@/lib/s3-presigned";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const hotel = await prisma.hotel.findUnique({
      where: {
        id,
        isDeleted: false,
      },
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
        rooms: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            price: "asc",
          },
        },
      },
    });

    if (!hotel) {
      return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
    }

    // Pre-sign S3 URLs
    const [logo, banner] = await Promise.all([
      getPresignedUrlOrOriginal(hotel.logo),
      getPresignedUrlOrOriginal(hotel.banner)
    ]);
    hotel.logo = logo;
    hotel.banner = banner;

    let parsedImages = [];
    try {
      parsedImages = typeof hotel.images === 'string' ? JSON.parse(hotel.images) : hotel.images;
    } catch (e) {}
    if (Array.isArray(parsedImages)) {
      hotel.images = await Promise.all(parsedImages.map(img => getPresignedUrlOrOriginal(img)));
    }

    if (hotel.rooms) {
      hotel.rooms = await Promise.all(
        hotel.rooms.map(async (room) => {
          let roomImages = [];
          try {
            roomImages = typeof room.images === 'string' ? JSON.parse(room.images) : room.images;
          } catch (e) {}
          if (Array.isArray(roomImages)) {
            room.images = await Promise.all(roomImages.map(img => getPresignedUrlOrOriginal(img)));
          }
          return room;
        })
      );
    }

    return NextResponse.json(hotel);
  } catch (error) {
    console.error("Error fetching admin hotel details:", error);
    return NextResponse.json(
      { error: "Failed to fetch hotel details" },
      { status: 500 }
    );
  }
}

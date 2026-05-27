import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";

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

    return NextResponse.json(hotel);
  } catch (error) {
    console.error("Error fetching admin hotel details:", error);
    return NextResponse.json(
      { error: "Failed to fetch hotel details" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET a single active ad by id with connected product/service for the ad page. Public, no auth. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Ad id required" }, { status: 400 });

  const now = new Date();
  try {
    const ad = await prisma.sellerAd.findFirst({
      where: {
        id,
        status: "ACTIVE",
        startAt: { lte: now },
        endAt: { gte: now },
      },
      select: {
        id: true,
        title: true,
        creativeType: true,
        creativeUrl: true,
        productId: true,
        serviceId: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: true,
            category: { select: { name: true } },
            seller: { select: { store: { select: { name: true } } } },
            variants: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: { price: true, discount: true },
            },
            _count: { select: { reviews: true } },
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            images: true,
            category: { select: { name: true } },
            seller: { select: { store: { select: { name: true } } } },
            _count: { select: { reviews: true } },
          },
        },
      },
    });

    if (!ad) return NextResponse.json({ error: "Ad not found" }, { status: 404 });

    const firstVariant = (ad.product as { variants?: { price: number; discount: number }[] } | null)?.variants?.[0];
    const product = ad.product
      ? {
          id: ad.product.id,
          name: ad.product.name,
          slug: ad.product.slug,
          images: ad.product.images,
          category: ad.product.category,
          seller: ad.product.seller,
          _count: ad.product._count,
          basePrice: firstVariant?.price ?? 0,
          discount: firstVariant?.discount ?? 0,
        }
      : null;

    return NextResponse.json({
      id: ad.id,
      title: ad.title,
      creativeType: ad.creativeType,
      creativeUrl: ad.creativeUrl,
      productId: ad.productId,
      serviceId: ad.serviceId,
      product,
      service: ad.service,
    });
  } catch (error) {
    console.error("Error fetching ad:", error);
    return NextResponse.json({ error: "Failed to fetch ad" }, { status: 500 });
  }
}

/** Normalize service.image + service.galleryImages JSON (Prisma) into URL arrays. */

export function extractImageUrls(images: unknown): string[] {
  if (Array.isArray(images)) return images.filter((value): value is string => typeof value === "string")
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === "string")
    } catch {
      return []
    }
  }
  return []
}

/** Master = `images[0]`; gallery = `galleryImages` when set, else legacy `images.slice(1)`. */
export function parseServiceImagesForSellerForm(service: {
  images?: unknown
  galleryImages?: unknown
}): { masterUrl: string | null; galleryUrls: string[] } {
  const fromImages = extractImageUrls(service.images)
  const fromGalleryField = extractImageUrls(service.galleryImages)
  if (fromGalleryField.length > 0) {
    return { masterUrl: fromImages[0] ?? null, galleryUrls: fromGalleryField }
  }
  if (fromImages.length <= 1) {
    return { masterUrl: fromImages[0] ?? null, galleryUrls: [] }
  }
  return { masterUrl: fromImages[0] ?? null, galleryUrls: fromImages.slice(1) }
}

/** Full carousel/list order: master first, then gallery. */
export function getServiceDisplayImageUrls(service: {
  images?: unknown
  galleryImages?: unknown
}): string[] {
  const { masterUrl, galleryUrls } = parseServiceImagesForSellerForm(service)
  if (!masterUrl) return [...galleryUrls]
  return [masterUrl, ...galleryUrls]
}

/** First thumbnail for cards / listings. */
export function getServiceFirstDisplayImageUrl(service: {
  images?: unknown
  galleryImages?: unknown
}): string | null {
  const urls = getServiceDisplayImageUrls(service)
  return urls[0] ?? null
}

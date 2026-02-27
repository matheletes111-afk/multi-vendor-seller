/**
 * Returns YouTube video ID if the given URL is a YouTube link, otherwise null.
 */
export function getYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null
  try {
    const u = new URL(url.trim())
    if (u.hostname === "youtu.be" && u.pathname.slice(1)) {
      return u.pathname.slice(1).split("/")[0]
    }
    if (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname === "/watch" &&
      u.searchParams.get("v")
    ) {
      return u.searchParams.get("v")
    }
    if (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname.startsWith("/embed/")
    ) {
      return u.pathname.replace("/embed/", "").split("/")[0]
    }
    return null
  } catch {
    return null
  }
}

/** YouTube thumbnail URL (hqdefault = 480x360). Use maxresdefault for 1280x720 if needed. */
export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = getYoutubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

/**
 * Returns YouTube embed URL if the given URL is a YouTube watch/share link, otherwise null.
 * Supports: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
 */
export function getYoutubeEmbedUrl(url: string): string | null {
  const id = getYoutubeVideoId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}

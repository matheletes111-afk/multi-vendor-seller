/**
 * Returns YouTube video ID if the given URL is a YouTube link, otherwise null.
 */
export function getYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null
  try {
    const trimmed = url.trim()
    // Handle youtu.be short links
    if (trimmed.includes("youtu.be/")) {
      return trimmed.split("youtu.be/")[1]?.split(/[?#]/)[0] ?? null
    }

    const u = new URL(trimmed)
    const hostname = u.hostname.replace("www.", "")
    
    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      // Standard watch URL
      if (u.pathname === "/watch") {
        return u.searchParams.get("v")
      }
      // Embed URL
      if (u.pathname.startsWith("/embed/")) {
        return u.pathname.replace("/embed/", "").split("/")[0]
      }
      // Shorts URL
      if (u.pathname.startsWith("/shorts/")) {
        return u.pathname.replace("/shorts/", "").split("/")[0]
      }
      // v= variant in path (rare)
      if (u.pathname.startsWith("/v/")) {
        return u.pathname.replace("/v/", "").split("/")[0]
      }
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

/**
 * Global loader for Google Maps JavaScript API and server-side API key.
 * Caches the key promise and script loading promise to ensure:
 * 1. /api/utils/maps-key is only fetched ONCE per session across all components.
 * 2. The Google Maps script tag is injected only ONCE into the DOM.
 */

declare global {
  interface Window {
    google: any
  }
}

let cachedMapsKeyPromise: Promise<string> | null = null
let cachedMapsScriptPromise: Promise<void> | null = null

/**
 * Fetches the Google Maps API key once from `/api/utils/maps-key` and caches the result.
 */
export async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedMapsKeyPromise) {
    return cachedMapsKeyPromise
  }

  cachedMapsKeyPromise = (async () => {
    try {
      const res = await fetch("/api/utils/maps-key")
      if (!res.ok) {
        throw new Error("Google Maps API key unavailable or unauthorized")
      }
      const data = await res.json()
      if (!data?.key) {
        throw new Error("Google Maps API key not configured")
      }
      return data.key as string
    } catch (err) {
      // Clear cache on failure so future attempts can retry
      cachedMapsKeyPromise = null
      throw err
    }
  })()

  return cachedMapsKeyPromise
}

/**
 * Loads the Google Maps script once in the browser and resolves when `window.google.maps` is ready.
 */
export async function loadGoogleMapsScript(libraries: string[] = ["places"]): Promise<void> {
  if (typeof window === "undefined") return

  if (window.google?.maps?.places) {
    return Promise.resolve()
  }

  if (cachedMapsScriptPromise) {
    return cachedMapsScriptPromise
  }

  cachedMapsScriptPromise = (async () => {
    try {
      if (window.google?.maps?.places) {
        return
      }

      const apiKey = await getGoogleMapsApiKey()

      if (window.google?.maps?.places) {
        return
      }

      await new Promise<void>((resolve, reject) => {
        const callbackName = `__googleMapsCallback_${Date.now()}`
        ;(window as any)[callbackName] = () => {
          try {
            delete (window as any)[callbackName]
          } catch {
            ;(window as any)[callbackName] = undefined
          }
          resolve()
        }

        const script = document.createElement("script")
        const libQuery = libraries.length > 0 ? `&libraries=${libraries.join(",")}` : ""
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}${libQuery}&callback=${callbackName}`
        script.async = true
        script.defer = true
        script.onerror = () => {
          try {
            delete (window as any)[callbackName]
          } catch {
            ;(window as any)[callbackName] = undefined
          }
          reject(new Error("Failed to load Google Maps script"))
        }
        document.head.appendChild(script)
      })
    } catch (err) {
      cachedMapsScriptPromise = null
      throw err
    }
  })()

  return cachedMapsScriptPromise
}

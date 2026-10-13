/**
 * Sanitizes and extracts width/height from the raw binary header of an image.
 * Supports PNG, JPEG, GIF, and WebP (VP8, VP8L, VP8X).
 * Safe for both browser and Node.js environments.
 */
export function getImageDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 16) return null

  // PNG Check
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (buffer.length >= 24) {
      const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19]
      const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23]
      return { width: width >>> 0, height: height >>> 0 }
    }
  }

  // GIF Check
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    if (buffer.length >= 10) {
      const width = buffer[6] | (buffer[7] << 8)
      const height = buffer[8] | (buffer[9] << 8)
      return { width, height }
    }
  }

  // WebP Check
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    const type = String.fromCharCode(buffer[12], buffer[13], buffer[14], buffer[15])
    if (type === "VP8X") {
      if (buffer.length >= 30) {
        const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16))
        const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16))
        return { width, height }
      }
    } else if (type === "VP8 ") {
      if (buffer.length >= 30) {
        if (buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
          const width = (buffer[26] | (buffer[27] << 8)) & 0x3fff
          const height = (buffer[28] | (buffer[29] << 8)) & 0x3fff
          return { width, height }
        }
      }
    } else if (type === "VP8L") {
      if (buffer.length >= 25) {
        if (buffer[20] === 0x2f) {
          const width = 1 + (((buffer[22] & 0x3f) << 8) | buffer[21])
          const height = 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6))
          return { width, height }
        }
      }
    }
  }

  // JPEG Check
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let i = 2
    while (i < buffer.length - 1) {
      if (buffer[i] !== 0xff) break
      const marker = buffer[i + 1]
      // SOF0 (0xc0) to SOF15 (0xcf) markers except SOF4 (0xc4), SOF8 (0xc8), SOF12 (0xcc)
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSOF) {
        if (i + 9 <= buffer.length) {
          const height = (buffer[i + 5] << 8) | buffer[i + 6]
          const width = (buffer[i + 7] << 8) | buffer[i + 8]
          return { width, height }
        }
        break
      }
      if (i + 4 > buffer.length) break
      const segLen = (buffer[i + 2] << 8) | buffer[i + 3]
      i += 2 + segLen
    }
  }

  return null
}

function getFileHeaderDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    // Only slice first 64KB (sufficient for image headers including large JPEG APP segments)
    const blob = file.slice(0, 65536)
    const reader = new FileReader()
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer)
      resolve(getImageDimensions(arr))
    }
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(blob)
  })
}

/**
 * Client-side image compression utility.
 * Resizes images to fit within maximum dimensions (1200px) and compresses them
 * to 80% quality JPEG (or WebP if original is WebP).
 * Includes protection against Client-Side Denial of Service (Pixel Flood).
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<File> {
  const MAX_DIMENSION = 24000 // Max 24000x24000 pixels (supports modern 48MP, 108MP, 200MP phone cameras while preventing multi-gigabyte pixel flood bombs)

  // Check dimensions from headers first to prevent loading pixel floods into browser memory
  try {
    const dims = await getFileHeaderDimensions(file)
    if (dims) {
      if (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) {
        throw new Error(
          `Image dimensions exceed the maximum allowed limit of ${MAX_DIMENSION}x${MAX_DIMENSION} pixels (detected ${dims.width}x${dims.height}). This upload has been blocked to prevent denial of service.`
        )
      }
    }
  } catch (err: any) {
    if (err instanceof Error && err.message.includes("dimensions exceed")) {
      throw err
    }
  }

  const fileName = file.name || ""
  const isImageByExt = /\.(jpe?g|png|webp|heic|heif|bmp|tiff?|avif)$/i.test(fileName)
  const isImageByType = (file.type || "").startsWith("image/")
  const isGif = file.type === "image/gif" || /\.gif$/i.test(fileName)
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(fileName)

  // Only bypass non-images, animated GIFs, or SVGs
  if (isGif || isSvg || (!isImageByType && !isImageByExt)) {
    return file
  }

  // 1. Detect HEIC format (common on iPhone / iOS Safari)
  let fileToProcess: File = file
  const isHeic = isHeicFormat(file) || (await isHeicByHeader(file))

  if (isHeic && typeof window !== "undefined") {
    try {
      const convertedJpeg = await convertHeicToJpeg(file, 0.9)
      if (convertedJpeg && convertedJpeg !== file) {
        fileToProcess = convertedJpeg
      }
    } catch (heicErr) {
      console.warn("Client HEIC conversion failed, proceeding with fallback decoding:", heicErr)
    }
  }

  return new Promise((resolve) => {
    let resolved = false
    let objectUrl = ""

    const safeResolve = (result: File) => {
      if (resolved) return
      resolved = true
      if (timer) clearTimeout(timer)
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl)
        } catch (_) {}
      }
      resolve(result)
    }

    // Safety timeout: if decoding hangs, release safely
    const timer = setTimeout(() => {
      safeResolve(fileToProcess)
    }, 10000)

    const cleanName = (fileToProcess.name || fileName || "photo").replace(/\.[^/.]+$/, "") || "photo"

    const renderToCanvasAndResolve = (source: CanvasImageSource, naturalWidth: number, naturalHeight: number) => {
      let width = naturalWidth
      let height = naturalHeight

      if (!width || !height) {
        if (typeof (source as any).close === "function") {
          try { (source as any).close() } catch (_) {}
        }
        safeResolve(fileToProcess)
        return
      }

      // Calculate dimensions to maintain aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        } else {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        if (typeof (source as any).close === "function") {
          try { (source as any).close() } catch (_) {}
        }
        safeResolve(fileToProcess)
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      try {
        ctx.drawImage(source, 0, 0, width, height)
      } catch (_) {
        if (typeof (source as any).close === "function") {
          try { (source as any).close() } catch (_) {}
        }
        safeResolve(fileToProcess)
        return
      }

      if (typeof (source as any).close === "function") {
        try { (source as any).close() } catch (_) {}
      }

      // Export to WebP (with JPEG fallback for older engines)
      const tryExportWebp = () => {
        canvas.toBlob(
          (webpBlob) => {
            // Check if WebP export succeeded and is actually a webp MIME type
            if (webpBlob && (webpBlob.type === "image/webp" || !webpBlob.type)) {
              const compressedFile = new File([webpBlob], `${cleanName}.webp`, {
                type: "image/webp",
                lastModified: Date.now(),
              })

              // If still over 850KB (rare noisy photo), perform a quick secondary downscale to strictly keep in KBs
              if (compressedFile.size > 850 * 1024 && (width > 900 || height > 900)) {
                try {
                  const pass2Canvas = document.createElement("canvas")
                  const pass2W = Math.round(width * 0.75)
                  const pass2H = Math.round(height * 0.75)
                  pass2Canvas.width = pass2W
                  pass2Canvas.height = pass2H
                  const p2Ctx = pass2Canvas.getContext("2d")
                  if (p2Ctx) {
                    p2Ctx.drawImage(canvas, 0, 0, pass2W, pass2H)
                    pass2Canvas.toBlob(
                      (p2Blob) => {
                        if (p2Blob) {
                          safeResolve(
                            new File([p2Blob], `${cleanName}.webp`, {
                              type: "image/webp",
                              lastModified: Date.now(),
                            })
                          )
                          return
                        }
                        safeResolve(compressedFile)
                      },
                      "image/webp",
                      0.72
                    )
                    return
                  }
                } catch (_) {}
              }

              safeResolve(compressedFile)
            } else {
              // Fallback to JPEG if browser doesn't support WebP canvas encoding
              tryExportJpeg()
            }
          },
          "image/webp",
          quality
        )
      }

      const tryExportJpeg = () => {
        canvas.toBlob(
          (jpegBlob) => {
            if (!jpegBlob) {
              safeResolve(fileToProcess)
              return
            }
            safeResolve(
              new File([jpegBlob], `${cleanName}.jpg`, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
            )
          },
          "image/jpeg",
          quality
        )
      }

      tryExportWebp()
    }

    // Attempt modern createImageBitmap first
    if (typeof createImageBitmap === "function") {
      createImageBitmap(fileToProcess)
        .then((bitmap) => {
          renderToCanvasAndResolve(bitmap, bitmap.width, bitmap.height)
        })
        .catch(() => {
          loadViaImageElement()
        })
    } else {
      loadViaImageElement()
    }

    function loadViaImageElement() {
      try {
        objectUrl = URL.createObjectURL(fileToProcess)
      } catch (_) {
        safeResolve(fileToProcess)
        return
      }

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        renderToCanvasAndResolve(img, img.naturalWidth || img.width, img.naturalHeight || img.height)
      }
      img.onerror = () => {
        safeResolve(fileToProcess)
      }
      img.src = objectUrl
    }
  })
}

/**
 * Checks if a file or object represents a HEIC/HEIF image by filename or MIME type.
 */
export function isHeicFormat(file: { name?: string; type?: string }): boolean {
  if (!file) return false
  const name = (file.name || "").toLowerCase()
  const type = (file.type || "").toLowerCase().trim()
  if (/\.(heic|heif)$/i.test(name)) return true
  if (type.includes("heic") || type.includes("heif")) return true
  return false
}

/**
 * Robustly inspects the initial bytes of a file to check for HEIC/HEIF ftyp signatures.
 */
export async function isHeicByHeader(file: File | Blob): Promise<boolean> {
  if (!file || typeof file.slice !== "function") return false
  try {
    const slice = file.slice(0, 16)
    const buf = new Uint8Array(await slice.arrayBuffer())
    if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
      const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]).toLowerCase()
      if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
        return true
      }
    }
  } catch (_) {}
  return false
}

/**
 * Converts a HEIC / HEIF image file or blob to standard JPEG format in the browser.
 * Uses dynamic import so server-side Next.js bundle is unaffected.
 */
export async function convertHeicToJpeg(file: File | Blob, quality = 0.9): Promise<File> {
  if (typeof window === "undefined") {
    return file instanceof File ? file : new File([file], "image.jpg", { type: "image/jpeg" })
  }

  const rawName = file instanceof File ? file.name : "photo.heic"
  const cleanName = rawName.replace(/\.[^/.]+$/, "") || "photo"

  try {
    const heic2anyModule = await import("heic2any")
    const heic2any = heic2anyModule.default || heic2anyModule

    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality,
    })

    const jpegBlob = Array.isArray(converted) ? converted[0] : converted
    return new File([jpegBlob], `${cleanName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } catch (err) {
    console.warn("heic2any conversion error:", err)
    return file instanceof File ? file : new File([file], `${cleanName}.jpg`, { type: "image/jpeg" })
  }
}



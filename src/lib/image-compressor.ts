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
  const MAX_DIMENSION = 8000 // Max 8000x8000 pixels to prevent Pixel Flood DoS

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

  // Only compress JPEGs, PNGs, and WebPs. Keep GIFs (animations) intact.
  const compressableTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!compressableTypes.includes(file.type)) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        let width = img.width
        let height = img.height

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
          resolve(file)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        const outputType = file.type === "image/webp" ? "image/webp" : "image/jpeg"

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }

            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now(),
            })

            // Only use compressed file if it's actually smaller
            if (compressedFile.size >= file.size) {
              resolve(file)
            } else {
              resolve(compressedFile)
            }
          },
          outputType,
          quality
        )
      }
      img.onerror = () => reject(new Error("Failed to load image."))
    }
    reader.onerror = () => reject(new Error("Failed to read image file."))
  })
}


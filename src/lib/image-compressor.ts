/**
 * Client-side image compression utility.
 * Resizes images to fit within maximum dimensions (1200px) and compresses them
 * to 80% quality JPEG (or WebP if original is WebP).
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<File> {
  // Only compress JPEGs, PNGs, and WebPs. Keep GIFs (animations) intact.
  const compressableTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!compressableTypes.includes(file.type)) {
    return file
  }

  return new Promise((resolve) => {
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
      img.onerror = () => resolve(file)
    }
    reader.onerror = () => resolve(file)
  })
}

"use client"

import Image from "next/image"
import { ImageIcon } from "lucide-react"
import { useState } from "react"

export function AdImage({ image, title }) {
  const [imageError, setImageError] = useState(false)

  if (!image || imageError) {
    return (
      <div className="w-full h-40 rounded-md bg-gray-100 flex items-center justify-center border">
        <ImageIcon className="h-10 w-10 text-gray-400" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-40 rounded-md overflow-hidden bg-gray-100 border">
      <Image
        src={image}
        alt={title}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  )
}
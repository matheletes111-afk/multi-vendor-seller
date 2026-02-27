"use client"

import { useRef } from "react"
import { Button } from "@/ui/button"
import { Image as ImageIcon } from "lucide-react"
import { useState } from "react";
interface ImageUploadProps {
  onImageSelect: (file: File | null) => void
  currentImage?: string | null
}

export function ImageUpload({ onImageSelect, currentImage }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB")
        return
      }

      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file")
        return
      }

      setFileName(file.name)
      onImageSelect(file)
    }
  }

  const handleRemove = () => {
    setFileName("")
    onImageSelect(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          {fileName ? "Change Image" : "Upload Image"}
        </Button>
        {fileName && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
          >
            Remove
          </Button>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/*{fileName && (
        <p className="text-sm text-muted-foreground">
          Selected: {fileName}
        </p>
      )}*/}
    </div>
  )
}
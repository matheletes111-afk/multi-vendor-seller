"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Loader2, User, Upload, Camera, Crop } from "lucide-react";
import { ImageCropperModal } from "@/components/media/image-cropper-modal";
import { CameraCaptureModal } from "@/components/media/camera-capture-modal";

const MAX_MB = 50; // Allow up to 50MB raw phone photos before client-side compression down to KBs
const MAX_BYTES = MAX_MB * 1024 * 1024;

interface ProfilePictureInputProps {
  currentImage?: string | null;
  /** Name for the file input (e.g. "profileImage") so FormData includes the file */
  fileInputName?: string;
  /** Name for the optional URL input (e.g. "image") */
  urlInputName?: string;
  /** Show optional "Or image URL" field */
  showUrlField?: boolean;
  size?: "sm" | "md" | "lg";
  /** Callback when image is selected and compressed */
  onImageChange?: (file: File | null) => void;
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

export function ProfilePictureInput({
  currentImage,
  fileInputName = "profileImage",
  urlInputName = "image",
  showUrlField = false,
  size = "md",
  onImageChange,
}: ProfilePictureInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);

  const displayUrl = previewUrl || currentImage || null;

  const processAndApplyImage = async (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setIsProcessing(true);

    try {
      const { compressImage } = await import("@/lib/image-compressor");
      // Compresses down to crisp 600x600 WebP (typically 40KB - 80KB)
      const compressed = await compressImage(file, 600, 600, 0.85);

      if (fileInputRef.current) {
        try {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(compressed);
          fileInputRef.current.files = dataTransfer.files;
        } catch (dtErr) {
          console.warn("Could not set files via DataTransfer:", dtErr);
        }
      }

      const newUrl = URL.createObjectURL(compressed);
      setPreviewUrl(newUrl);
      setSelectedFile(compressed);
      onImageChange?.(compressed);
    } catch (error) {
      if (error instanceof Error && error.message.includes("dimensions exceed")) {
        alert(error.message);
        onImageChange?.(null);
        return;
      }
      try {
        const newUrl = URL.createObjectURL(file);
        setPreviewUrl(newUrl);
        setSelectedFile(file);
        onImageChange?.(file);
      } catch (_) {
        alert("Could not process the selected image.");
        onImageChange?.(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      onImageChange?.(null);
      return;
    }

    const isImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|heic|heif|avif|bmp|tiff?)$/i.test(file.name);

    if (!isImage) {
      alert("Please select an image file (JPG, PNG, WebP, or HEIC)");
      e.target.value = "";
      onImageChange?.(null);
      return;
    }

    if (file.size > MAX_BYTES) {
      alert(`Image file is too large (must be under ${MAX_MB} MB).`);
      e.target.value = "";
      onImageChange?.(null);
      return;
    }

    // Reset input value so re-selecting same file triggers change
    e.target.value = "";

    setIsProcessing(true);
    try {
      const { compressImage } = await import("@/lib/image-compressor");
      // Prepare high-res converted JPEG/WebP for cropping modal (prevents Safari HEIC crashes)
      const prepped = await compressImage(file, 1600, 1600, 0.9);
      setFileToCrop(prepped);
      setCropperOpen(true);
    } catch (err: any) {
      console.error("Image preparation error:", err);
      // Fallback: pass raw file to cropper modal
      setFileToCrop(file);
      setCropperOpen(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhotoCaptured = async (file: File) => {
    setIsProcessing(true);
    try {
      const { compressImage } = await import("@/lib/image-compressor");
      const prepped = await compressImage(file, 1600, 1600, 0.9);
      setFileToCrop(prepped);
      setCropperOpen(true);
    } catch (_) {
      setFileToCrop(file);
      setCropperOpen(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    processAndApplyImage(croppedFile);
  };

  const avatarSize = sizeClasses[size];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className={`${avatarSize} shrink-0 ring-2 ring-muted relative overflow-hidden`}>
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt="Profile" className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-muted text-muted-foreground">
            <User className="h-8 w-8 sm:h-10 sm:w-10" />
          </AvatarFallback>
          {isProcessing && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white backdrop-blur-xs">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </Avatar>
        <div className="flex flex-col gap-2 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            name={fileInputName}
            accept="image/*,image/jpeg,image/png,image/webp,.heic,.heif,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            disabled={isProcessing}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-8"
            >
              {isProcessing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isProcessing ? "Processing..." : "Upload photo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => setCameraOpen(true)}
              className="text-xs h-8 text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <Camera className="mr-1.5 h-3.5 w-3.5 text-purple-600" />
              Take photo
            </Button>
            {displayUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isProcessing}
                onClick={() => {
                  if (selectedFile) {
                    setFileToCrop(selectedFile);
                    setCropperOpen(true);
                  } else if (displayUrl) {
                    fetch(displayUrl)
                      .then((res) => res.blob())
                      .then((blob) => {
                        const file = new File([blob], "profile.jpg", { type: blob.type || "image/jpeg" });
                        setFileToCrop(file);
                        setCropperOpen(true);
                      })
                      .catch(() => {});
                  }
                }}
                className="text-xs h-8 text-blue-600 hover:bg-blue-50"
              >
                <Crop className="mr-1.5 h-3.5 w-3.5" />
                Crop
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            All formats (JPG, PNG, WebP, HEIC). Auto-compressed to KBs.
          </p>
        </div>
      </div>
      {showUrlField && (
        <div className="space-y-2">
          <Label htmlFor={urlInputName}>Or image URL</Label>
          <Input
            id={urlInputName}
            name={urlInputName}
            type="url"
            defaultValue={currentImage || ""}
            placeholder="https://example.com/photo.jpg"
          />
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onPhotoCaptured={handlePhotoCaptured}
        facingMode="user"
        guideType="circle"
        title="Take Profile Photo"
      />

      {/* 1:1 Image Cropper Modal */}
      <ImageCropperModal
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        imageFile={fileToCrop}
        onCropComplete={handleCropComplete}
        aspectRatio="1:1"
        title="Crop Profile Photo"
      />
    </div>
  );
}

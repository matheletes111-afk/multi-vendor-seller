"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { User, Upload } from "lucide-react";

const MAX_MB = 2;
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
}: ProfilePictureInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayUrl = previewUrl || currentImage || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      alert(`Image must be under ${MAX_MB} MB`);
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (e.g. JPG, PNG)");
      e.target.value = "";
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const avatarSize = sizeClasses[size];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className={`${avatarSize} shrink-0 ring-2 ring-muted`}>
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt="Profile" className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-muted text-muted-foreground">
            <User className="h-8 w-8 sm:h-10 sm:w-10" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            name={fileInputName}
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload photo
          </Button>
          <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max {MAX_MB} MB.</p>
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
    </div>
  );
}

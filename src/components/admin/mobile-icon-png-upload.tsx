"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Upload, Smartphone } from "lucide-react";

const MAX_MB = 2;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const PNG_MIME = "image/png";

export type MobileIconPngValue =
  | { type: "url"; url: string }
  | { type: "file"; file: File }
  | null;

interface MobileIconPngUploadProps {
  value: MobileIconPngValue;
  onChange: (value: MobileIconPngValue) => void;
  currentImage?: string | null;
  label?: string;
  showPreview?: boolean;
}

/** Mobile icon: PNG only (file upload or URL ending in .png). */
export function MobileIconPngUpload({
  value,
  onChange,
  currentImage,
  label = "Mobile icon (PNG only)",
  showPreview = true,
}: MobileIconPngUploadProps) {
  const [urlInput, setUrlInput] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const previewUrl =
    value?.type === "url"
      ? value.url
      : value?.type === "file"
        ? filePreview
        : currentImage || null;

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    setUrlInput(v);
    if (v) {
      onChange({ type: "url", url: v });
    } else {
      onChange(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (!file) {
      onChange(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      alert(`File must be under ${MAX_MB} MB`);
      e.target.value = "";
      return;
    }
    if (file.type !== PNG_MIME) {
      alert("Only PNG files are accepted for mobile icon.");
      e.target.value = "";
      return;
    }
    setFilePreview(URL.createObjectURL(file));
    onChange({ type: "file", file });
  };

  const handleRemove = () => {
    setUrlInput("");
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange(null);
  };

  return (
    <div className="space-y-3">
      {label && (
        <Label className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          {label}
          <span className="text-muted-foreground font-normal">(PNG only)</span>
        </Label>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {value?.type === "file" ? "Change PNG" : "Upload PNG"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,image/png"
          className="hidden"
          onChange={handleFileChange}
        />
        <span className="text-sm text-muted-foreground">or</span>
        <Input
          type="url"
          value={urlInput || (value?.type === "url" ? value.url : "")}
          onChange={handleUrlChange}
          placeholder="https://example.com/icon.png"
          className="max-w-xs"
        />
        {(value || currentImage) && (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
            Remove
          </Button>
        )}
      </div>
      {showPreview && previewUrl && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-1">Preview</p>
          <div className="relative w-16 h-16 rounded-lg border overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Mobile icon"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

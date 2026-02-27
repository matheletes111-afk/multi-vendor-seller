"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Link as LinkIcon, Upload, ImageIcon } from "lucide-react";

const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export type ImageLinkOrUploadValue =
  | { type: "url"; url: string }
  | { type: "file"; file: File }
  | null;

interface ImageLinkOrUploadProps {
  value: ImageLinkOrUploadValue;
  onChange: (value: ImageLinkOrUploadValue) => void;
  currentImage?: string | null;
  label?: string;
  showPreview?: boolean;
  required?: boolean;
}

export function ImageLinkOrUpload({
  value,
  onChange,
  currentImage,
  label = "Image",
  showPreview = true,
  required = false,
}: ImageLinkOrUploadProps) {
  const [mode, setMode] = useState<"link" | "upload">("upload");
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
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
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

  const switchToLink = () => {
    setMode("link");
    if (value?.type === "file" && filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const switchToUpload = () => {
    setMode("upload");
    setUrlInput("");
    onChange(null);
  };

  return (
    <div className="space-y-3">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      <div className="flex gap-2 p-2 rounded-lg border bg-muted/30">
        <button
          type="button"
          onClick={() => {
            setMode("upload");
            setUrlInput("");
            onChange(null);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Upload className="h-4 w-4" />
          Upload file
        </button>
        <button
          type="button"
          onClick={switchToLink}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === "link" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <LinkIcon className="h-4 w-4" />
          Image link
        </button>
      </div>

      {mode === "link" ? (
        <div className="space-y-2">
          <Input
            type="url"
            value={urlInput || (value?.type === "url" ? value.url : "")}
            onChange={handleUrlChange}
            placeholder="https://example.com/image.jpg"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            {value?.type === "file" ? "Change image" : "Choose image"}
          </Button>
          {(value || currentImage) && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
              Remove
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {showPreview && previewUrl && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-1">Preview</p>
          <div className="relative w-32 h-32 rounded-lg border overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover"
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

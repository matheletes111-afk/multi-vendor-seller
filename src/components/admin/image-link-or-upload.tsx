"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Link as LinkIcon, Upload, ImageIcon, Trash2, CheckCircle2 } from "lucide-react";

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
  label = "Banner Image",
  showPreview = true,
  required = false,
}: ImageLinkOrUploadProps) {
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value?.type === "url") {
      setMode("link");
      setUrlInput(value.url);
    } else if (value?.type === "file") {
      setMode("upload");
    }
  }, [value]);

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

  const processFile = (file: File) => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);

    if (file.size > MAX_BYTES) {
      alert(`File must be under ${MAX_MB} MB`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }
    setFilePreview(URL.createObjectURL(file));
    onChange({ type: "file", file });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemove = () => {
    setUrlInput("");
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange(null);
  };

  return (
    <div className="space-y-4">
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-foreground">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <span className="text-xs text-muted-foreground">Max {MAX_MB}MB (JPEG, PNG, WebP)</span>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-muted/50 border border-muted">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            mode === "upload"
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Image File
        </button>
        <button
          type="button"
          onClick={() => setMode("link")}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            mode === "link"
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Image Web Link (URL)
        </button>
      </div>

      {/* Upload mode: Dropzone */}
      {mode === "upload" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
            isDragging
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="p-3 rounded-full bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
            <ImageIcon className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground text-center">
            {value?.type === "file" ? value.file.name : "Click to browse or drop banner image"}
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Recommended aspect ratio 16:9 or 21:9 for wide screens
          </p>
        </div>
      )}

      {/* Link mode: URL Input */}
      {mode === "link" && (
        <div className="space-y-2">
          <div className="relative">
            <Input
              type="url"
              value={urlInput}
              onChange={handleUrlChange}
              placeholder="Paste banner image URL (e.g. https://example.com/banner.jpg)"
              className="pr-10 h-11 text-sm rounded-xl"
            />
            {urlInput && (
              <CheckCircle2 className="absolute right-3 top-3.5 h-4 w-4 text-emerald-500" />
            )}
          </div>
        </div>
      )}

      {/* Image Preview Box */}
      {showPreview && previewUrl && (
        <div className="rounded-2xl border bg-card p-3 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {value?.type === "file"
                ? `Uploaded File: ${value.file.name}`
                : value?.type === "url"
                ? "External Image Link"
                : "Current Active Banner Image"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-2 rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remove
            </Button>
          </div>

          <div className="relative w-full aspect-[21/9] sm:aspect-[16/7] rounded-xl overflow-hidden bg-slate-950 border border-border shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Banner preview"
              className="w-full h-full object-cover object-top"
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

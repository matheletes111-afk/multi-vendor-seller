"use client"

import React, { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Camera, RefreshCw, AlertCircle, Sparkles, SwitchCamera, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type CameraGuideType = "card" | "circle" | "document" | "none"

interface CameraCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhotoCaptured: (file: File) => void
  facingMode?: "user" | "environment"
  title?: string
  guideType?: CameraGuideType
}

export function CameraCaptureModal({
  open,
  onOpenChange,
  onPhotoCaptured,
  facingMode: initialFacingMode = "environment",
  title = "Take Document Photo",
  guideType = "card",
}: CameraCaptureModalProps) {
  const [facingMode, setFacingMode] = useState<"user" | "environment">(initialFacingMode)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [flashActive, setFlashActive] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null)

  // Start / Stop camera stream when open changes
  useEffect(() => {
    let activeStream: MediaStream | null = null

    async function startCamera() {
      setCameraError(null)
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported in this browser.")
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
        activeStream = mediaStream
        setStream(mediaStream)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play().catch(() => {})
        }
      } catch (err: any) {
        console.warn("Could not start live video stream:", err)
        setCameraError(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Camera permission was denied. You can allow camera access in your browser settings or use the system camera below."
            : "Live camera could not be accessed. You can still use your device camera using the button below."
        )
      }
    }

    if (open) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [open, facingMode])

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

  // Toggle front / rear camera
  const handleToggleFacingMode = () => {
    stopCamera()
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
  }

  // Capture snapshot from video stream
  const handleCapture = () => {
    const video = videoRef.current
    if (!video || isCapturing) return

    setIsCapturing(true)
    setFlashActive(true)

    setTimeout(() => {
      setFlashActive(false)
    }, 150)

    try {
      const width = video.videoWidth || 1280
      const height = video.videoHeight || 720

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        setIsCapturing(false)
        return
      }

      // If user facing, mirror the image horizontally so it looks natural
      if (facingMode === "user") {
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
      }

      ctx.drawImage(video, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          setIsCapturing(false)
          if (!blob) return

          const file = new File([blob], `camera-photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })

          stopCamera()
          onOpenChange(false)
          onPhotoCaptured(file)
        },
        "image/jpeg",
        0.95
      )
    } catch (err) {
      console.error("Capture failed:", err)
      setIsCapturing(false)
    }
  }

  // Native camera fallback input change
  const handleNativeCameraFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      stopCamera()
      onOpenChange(false)
      onPhotoCaptured(file)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) stopCamera()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="max-w-xl w-[95vw] p-4 sm:p-6 overflow-hidden rounded-2xl flex flex-col max-h-[92vh]">
        <DialogHeader className="pb-2 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            {title}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleFacingMode}
            className="h-8 px-2 text-xs flex items-center gap-1.5 text-muted-foreground mr-6"
            title="Switch Camera (Front/Rear)"
          >
            <SwitchCamera className="w-4 h-4" />
            <span className="hidden sm:inline">Flip</span>
          </Button>
        </DialogHeader>

        {/* Hidden native camera capture input for fallbacks */}
        <input
          ref={nativeFileInputRef}
          type="file"
          accept="image/*"
          capture={facingMode}
          onChange={handleNativeCameraFile}
          className="hidden"
        />

        {/* Viewfinder area */}
        <div className="relative w-full h-[340px] sm:h-[400px] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center mt-2">
          {cameraError ? (
            <div className="p-6 text-center text-white space-y-4 max-w-sm">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs leading-relaxed text-slate-300">{cameraError}</p>
              <Button
                type="button"
                onClick={() => nativeFileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-10 px-5"
              >
                <Camera className="w-4 h-4 mr-2" />
                Open Device Camera
              </Button>
            </div>
          ) : (
            <>
              {/* Live Video */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={cn(
                  "w-full h-full object-cover",
                  facingMode === "user" && "scale-x-[-1]"
                )}
              />

              {/* White flash animation */}
              {flashActive && (
                <div className="absolute inset-0 bg-white pointer-events-none animate-in fade-in duration-75" />
              )}

              {/* Framing overlay guides */}
              {guideType === "card" && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-full max-w-[340px] aspect-[1.58/1] rounded-2xl border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] relative">
                    <span className="absolute top-2 left-3 text-[10px] font-semibold text-white/80 tracking-wide uppercase">
                      Align Card Here
                    </span>
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400" />
                  </div>
                </div>
              )}

              {guideType === "circle" && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-60 h-60 rounded-full border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-white/80 tracking-wide uppercase bg-black/40 px-2 py-0.5 rounded">
                      Center Face
                    </span>
                  </div>
                </div>
              )}

              {guideType === "document" && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-full max-w-[320px] aspect-[1/1.3] rounded-xl border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] relative">
                    <span className="absolute top-2 left-3 text-[10px] font-semibold text-white/80 tracking-wide uppercase">
                      Fit Full Document
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Shutter / Controls */}
        <div className="pt-4 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => nativeFileInputRef.current?.click()}
            className="text-xs"
          >
            System Camera
          </Button>

          {/* Large Shutter Button */}
          {!cameraError && (
            <button
              type="button"
              disabled={isCapturing}
              onClick={handleCapture}
              className="w-16 h-16 rounded-full border-4 border-blue-600 bg-white shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center p-1 cursor-pointer focus:outline-hidden"
              title="Snap Photo"
            >
              <div className="w-full h-full rounded-full bg-blue-600 hover:bg-blue-700 transition-colors" />
            </button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              stopCamera()
              onOpenChange(false)
            }}
            className="text-xs text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

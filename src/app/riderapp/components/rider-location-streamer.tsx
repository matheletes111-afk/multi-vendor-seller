"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { getSocketClient } from "@/lib/socket-client"

export function RiderLocationStreamer() {
  const { data: session } = useSession()
  const watchIdRef = useRef<number | null>(null)
  const lastHttpPostRef = useRef<number>(0)
  const [riderId, setRiderId] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(true)

  // Fetch actual Rider DB ID and initial online status
  useEffect(() => {
    if (session?.user?.id && session.user.role === "RIDER") {
      fetch("/api/riderapp/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data?.rider?.id) {
            setRiderId(data.rider.id)
            if (data.rider.isOnline !== undefined) {
              setIsOnline(Boolean(data.rider.isOnline))
            }
          } else {
            setRiderId(session.user.id)
          }
        })
        .catch(() => setRiderId(session.user.id))
    }

    const handleStatusEvent = (e: any) => {
      if (typeof e?.detail?.isOnline === "boolean") {
        setIsOnline(e.detail.isOnline)
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("rider:status_changed", handleStatusEvent)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("rider:status_changed", handleStatusEvent)
      }
    }
  }, [session])

  useEffect(() => {
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return
    }

    // If the rider is offline, DO NOT stream GPS coordinates!
    if (!isOnline) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }

    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    // Only mobile devices with moving hardware GPS should stream live coordinates.
    // Laptops and desktop browsers on stationary Wi-Fi/IP should not stream to avoid
    // overwriting the rider's live mobile GPS location.
    if (!isMobile) {
      return
    }

    if (!navigator.geolocation) {
      console.warn("[GPS Streamer] Geolocation is not supported by this browser.")
      return
    }

    const socket = getSocketClient()
    if (!socket.connected) {
      socket.auth = { riderId: riderId || session.user.id }
      socket.connect()
    }

    const handlePosition = (position: GeolocationPosition) => {
      const { latitude, longitude, heading, speed } = position.coords
      const currentRiderId = riderId || session.user.id

      // 1. Emit real-time coordinates over Socket.IO
      if (socket.connected) {
        socket.emit("rider:location_update", {
          riderId: currentRiderId,
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          isOnline: true,
        })
      }

      // 2. Throttle REST HTTP fallback update every 45s
      const now = Date.now()
      if (now - lastHttpPostRef.current > 45000) {
        lastHttpPostRef.current = now
        fetch("/api/riderapp/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude,
            longitude,
            heading: heading || 0,
            speed: speed || 0,
            isOnline: true,
          }),
        }).catch((err) => console.debug("[GPS Streamer] HTTP post error:", err))
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      console.warn("[GPS Streamer] Geolocation error:", error.message)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [session, riderId, isOnline])

  return null
}

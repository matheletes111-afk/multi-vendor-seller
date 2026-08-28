"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"

export function DeviceTokenListener() {
  const { data: session } = useSession()
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!session?.user?.id || (session.user as any).role !== "RIDER" || registeredRef.current) return

    async function registerDevice() {
      try {
        let deviceToken = localStorage.getItem("meeem_rider_device_token")
        if (!deviceToken) {
          deviceToken = "dev_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now()
          localStorage.setItem("meeem_rider_device_token", deviceToken)
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        )
        const platform = isMobile ? "mobile" : "web_laptop"

        await fetch("/api/riderapp/device-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: deviceToken,
            platform,
            userAgent: navigator.userAgent,
          }),
        })

        registeredRef.current = true
      } catch (err) {
        console.warn("Failed to register device token:", err)
      }
    }

    registerDevice()
  }, [session])

  return null
}

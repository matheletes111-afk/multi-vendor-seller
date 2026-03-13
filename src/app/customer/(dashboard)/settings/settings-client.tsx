"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"

type UserProfile = {
  id: string
  name: string | null
  email: string
  image: string | null
  phone: string | null
  phoneCountryCode: string | null
}

export function CustomerSettingsClient() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/customer/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const hasFile = fd.get("profileImage") instanceof File && (fd.get("profileImage") as File).size > 0
    setSaving(true)
    try {
      if (hasFile) {
        await fetch("/api/customer/settings", { method: "PUT", body: fd })
      } else {
        await fetch("/api/customer/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fd.get("name") || undefined,
            image: (fd.get("image") as string) || undefined,
            phone: (fd.get("phone") as string) ?? "",
            phoneCountryCode: (fd.get("phoneCountryCode") as string) ?? "",
          }),
        })
      }
      const res = await fetch("/api/customer/settings")
      if (res.ok) setUser(await res.json())
    } finally {
      setSaving(false)
    }
  }

  if (loading || !user) return <PageLoader message="Loading profile…" />

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Update your personal information. Phone and country code are optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>Profile picture</Label>
              <ProfilePictureInput currentImage={user.image} fileInputName="profileImage" urlInputName="image" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={user.name || ""} placeholder="Your name" />
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <div className="space-y-2">
                <Label htmlFor="phoneCountryCode">Country code</Label>
                <Input id="phoneCountryCode" name="phoneCountryCode" type="text" defaultValue={user.phoneCountryCode || ""} placeholder="+1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" defaultValue={user.phone || ""} placeholder="Phone number" />
              </div>
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

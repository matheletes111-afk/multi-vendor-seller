"use client"

import { useState, useEffect, useRef } from "react"
import { Label } from "@/ui/label"
import { Button } from "@/ui/button"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const COUNTRIES_URL = "https://restcountries.com/v3.1/all?fields=name,cca2"

type Country = { name: { common: string }; cca2: string }

export function CountryMultiSelect() {
  const [countries, setCountries] = useState<Country[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(COUNTRIES_URL)
      .then((res) => res.json())
      .then((data: Country[]) => {
        setCountries(data.sort((a, b) => a.name.common.localeCompare(b.name.common)))
      })
      .catch(() => setCountries([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filtered = countries.filter(
    (c) => c.name.common.toLowerCase().includes(search.toLowerCase()) || c.cca2.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  // Store full country names (not codes) for DB; use JSON to handle names containing commas
  const selectedNames = selected
    .map((code) => countries.find((c) => c.cca2 === code)?.name.common)
    .filter((n): n is string => !!n)
  const valueStr = selectedNames.length ? JSON.stringify(selectedNames) : ""

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>Target countries (optional)</Label>
      <input type="hidden" name="targetCountries" value={valueStr} readOnly />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
        >
          <span className="truncate">
            {selected.length === 0
              ? "Select countries..."
              : `${selected.length} selected`}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-md max-h-64 overflow-hidden flex flex-col">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mb-2"
            />
            <div className="overflow-y-auto flex-1 min-h-0">
              {loading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>
              ) : (
                filtered.slice(0, 200).map((c) => (
                  <label
                    key={c.cca2}
                    className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(c.cca2)}
                      onChange={() => toggle(c.cca2)}
                      className="rounded border-input"
                    />
                    <span className="text-sm">{c.name.common}</span>
                    <span className="text-xs text-muted-foreground">({c.cca2})</span>
                  </label>
                ))
              )}
            </div>
            {filtered.length > 200 && (
              <p className="text-xs text-muted-foreground pt-1">Type to search. Showing first 200.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

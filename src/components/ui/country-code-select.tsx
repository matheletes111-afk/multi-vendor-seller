"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Country,
  COUNTRIES,
  DEFAULT_COUNTRY,
  findCountryByDialCode,
  getFlagImageUrl,
} from "@/lib/countries"

export interface CountryCodeSelectProps {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (dialCode: string, country: Country) => void
  disabled?: boolean
  required?: boolean
  className?: string
  dropdownClassName?: string
  variant?: "default" | "compact" | "full"
  ariaLabel?: string
}

/**
 * Flag display component with 3-tier resilient fallback:
 * 1. High-res FlagCDN image
 * 2. Unicode Flag Emoji (if image fails to load/offline)
 * 3. Text ISO badge [SL]
 */
export function CountryFlag({
  country,
  className,
  size = "normal",
}: {
  country: Country
  className?: string
  size?: "small" | "normal" | "large"
}) {
  const [imgFailed, setImgFailed] = useState(false)

  const sizeClasses = {
    small: "w-4 h-3 text-xs",
    normal: "w-5 h-3.5 text-sm",
    large: "w-6 h-4 text-base",
  }[size]

  if (imgFailed) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center font-emoji select-none shrink-0 leading-none",
          sizeClasses,
          className
        )}
        title={country.name}
        aria-label={`${country.name} flag`}
      >
        {country.flagEmoji || country.code}
      </span>
    )
  }

  return (
    <img
      src={getFlagImageUrl(country.code)}
      alt={`${country.name} flag`}
      loading="lazy"
      onError={() => setImgFailed(true)}
      className={cn(
        "object-cover rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] shrink-0 select-none bg-slate-100",
        sizeClasses,
        className
      )}
    />
  )
}

export function CountryCodeSelect({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  disabled = false,
  required = false,
  className,
  dropdownClassName,
  variant = "default",
  ariaLabel = "Select country calling code",
}: CountryCodeSelectProps) {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState<string>(() => {
    return controlledValue || defaultValue || DEFAULT_COUNTRY.dialCode
  })

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeValue = isControlled ? controlledValue || "" : internalValue

  // Determine current active country with safe custom fallback
  const selectedCountry = useMemo(() => {
    if (!activeValue) return DEFAULT_COUNTRY
    const match = findCountryByDialCode(activeValue)
    if (match) return match
    const cleaned = String(activeValue).trim()
    if (!cleaned) return DEFAULT_COUNTRY
    const formatted = cleaned.startsWith("+") ? cleaned : `+${cleaned}`
    return {
      name: "Other",
      code: "UN",
      dialCode: formatted,
      flagEmoji: "🌐",
    }
  }, [activeValue])

  // Sync internal value if controlledValue changes
  useEffect(() => {
    if (isControlled && controlledValue !== undefined) {
      setInternalValue(controlledValue)
    }
  }, [isControlled, controlledValue])

  // Focus search input when opening dropdown
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("")
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (country: Country) => {
    if (disabled) return
    if (!isControlled) {
      setInternalValue(country.dialCode)
    }
    onChange?.(country.dialCode, country)
    setIsOpen(false)
  }

  // Filter countries by query (name, dialCode, or ISO code)
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return COUNTRIES

    const digitsOnly = q.replace(/\D/g, "")
    return COUNTRIES.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q)
      const codeMatch = c.code.toLowerCase().includes(q)
      const dialMatch = c.dialCode.includes(q) || (digitsOnly && c.dialCode.replace(/\D/g, "").includes(digitsOnly))
      return nameMatch || codeMatch || dialMatch
    })
  }, [searchQuery])

  return (
    <div ref={containerRef} className="relative inline-block w-full text-left font-sans">
      {/* Hidden input for standard native form submits and FormData */}
      {name && (
        <input
          type="hidden"
          name={name}
          id={id}
          value={selectedCountry.dialCode}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={name ? undefined : id}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "group flex w-full items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-all duration-150",
          "hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:border-slate-600 dark:focus:ring-slate-400/20",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-slate-900",
          isOpen && "ring-2 ring-slate-900/10 border-slate-400 dark:border-slate-500",
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <CountryFlag country={selectedCountry} />
          <span className="font-medium tracking-tight text-slate-900 dark:text-slate-100 shrink-0">
            {selectedCountry.dialCode}
          </span>
          {variant === "full" && (
            <span className="truncate text-xs text-slate-500 dark:text-slate-400 font-normal">
              {selectedCountry.name}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300",
            isOpen && "rotate-180 text-slate-600 dark:text-slate-200"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl backdrop-blur-md transition-all",
            "dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-100",
            dropdownClassName
          )}
          role="listbox"
        >
          {/* Search Header */}
          <div className="relative mb-2 px-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (filteredCountries.length > 0) {
                    handleSelect(filteredCountries[0])
                  }
                }
              }}
              placeholder="Search country or code..."
              className={cn(
                "w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5",
                "dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800"
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Country List */}
          <div className="max-h-60 overflow-y-auto overscroll-contain px-0.5 space-y-0.5 scrollbar-thin">
            {filteredCountries.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No matching country found.
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = selectedCountry.code === country.code && selectedCountry.dialCode === country.dialCode
                return (
                  <button
                    key={`${country.code}-${country.dialCode}`}
                    type="button"
                    onClick={() => handleSelect(country)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-colors text-left",
                      "hover:bg-slate-100 dark:hover:bg-slate-800",
                      isSelected
                        ? "bg-slate-100/90 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white"
                        : "text-slate-700 dark:text-slate-300"
                    )}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CountryFlag country={country} />
                      <span className="truncate">{country.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {country.dialCode}
                      </span>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

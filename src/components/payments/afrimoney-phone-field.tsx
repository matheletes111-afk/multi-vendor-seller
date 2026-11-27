"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/ui/input"
import { Smartphone, X } from "lucide-react"

/**
 * Validates a customer-entered AfriMoney mobile number before initiating Push USSD.
 * Supports Sierra Leone local formats (077123456, 77123456) and international (+23277123456).
 */
export function validateAfriMoneyPhone(rawPhone: string): string | null {
  const trimmed = rawPhone.trim()
  if (!trimmed) {
    return "Please enter your AfriMoney phone number to receive the payment prompt."
  }
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) {
    return "Please enter a valid AfriMoney mobile number (e.g. 077123456 or +23277123456)."
  }
  return null
}

/**
 * Manages AfriMoney phone state with non-sticky initial auto-fill from a suggested number.
 * Once the user edits or clears the input, auto-fill never overwrites or restores removed text.
 */
export function useAfriMoneyPhone(suggestedPhone?: string | null) {
  const [phone, setPhoneState] = useState("")
  const hasUserEditedRef = useRef(false)

  useEffect(() => {
    if (hasUserEditedRef.current) return
    const candidate = (suggestedPhone || "").trim()
    if (candidate) {
      setPhoneState(candidate)
    }
  }, [suggestedPhone])

  const setPhone = useCallback((nextValue: string) => {
    hasUserEditedRef.current = true
    setPhoneState(nextValue)
  }, [])

  const resetToSuggested = useCallback(() => {
    const candidate = (suggestedPhone || "").trim()
    hasUserEditedRef.current = false
    setPhoneState(candidate)
  }, [suggestedPhone])

  return { phone, setPhone, resetToSuggested }
}

interface AfriMoneyPhoneFieldProps {
  value: string
  onChange: (nextValue: string) => void
  suggestedPhone?: string | null
  onResetToSuggested?: () => void
  suggestedLabel?: string
  disabled?: boolean
  tone?: "amber" | "emerald"
  compact?: boolean
  helperText?: string
  placeholder?: string
}

/**
 * Editable, clearable AfriMoney phone number input for web checkout flows.
 */
export function AfriMoneyPhoneField({
  value,
  onChange,
  suggestedPhone,
  onResetToSuggested,
  suggestedLabel = "Use address number",
  disabled = false,
  tone = "amber",
  compact = false,
  helperText = "You will receive an instant prompt on your phone to enter your AfriMoney PIN and approve payment.",
  placeholder = "e.g. 077123456 or +23277123456",
}: AfriMoneyPhoneFieldProps) {
  const isEmerald = tone === "emerald"
  const cleanSuggested = (suggestedPhone || "").trim()
  const showUseSuggested =
    Boolean(cleanSuggested) &&
    Boolean(onResetToSuggested) &&
    value.trim() !== cleanSuggested

  const handleInputChange = (raw: string) => {
    // Allow digits, optional leading '+', spaces, hyphens, and parentheses for tel readability
    const sanitized = raw.replace(/[^\d+\s()-]/g, "")
    const normalizedPlus = sanitized.startsWith("+")
      ? "+" + sanitized.slice(1).replace(/\+/g, "")
      : sanitized.replace(/\+/g, "")
    onChange(normalizedPlus)
  }

  return (
    <div
      className={`rounded-xl border animate-in fade-in-50 ${
        compact ? "p-2.5 space-y-1.5" : "p-3 space-y-1.5"
      } ${
        isEmerald
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-amber-200 bg-amber-50/60"
      } mt-2`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          className={`${
            compact ? "text-[10px]" : "text-[11px]"
          } font-bold flex items-center gap-1 ${
            isEmerald ? "text-emerald-900" : "text-amber-900"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>AfriMoney Phone Number (Africell) *</span>
        </label>

        {showUseSuggested && (
          <button
            type="button"
            disabled={disabled}
            onClick={onResetToSuggested}
            className={`text-[10px] font-bold underline underline-offset-2 transition-colors disabled:opacity-50 ${
              isEmerald
                ? "text-emerald-700 hover:text-emerald-900"
                : "text-amber-800 hover:text-amber-950"
            }`}
          >
            {suggestedLabel}
          </button>
        )}
      </div>

      <div className="relative flex items-center">
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => handleInputChange(e.target.value)}
          className={`${
            compact ? "h-9 text-base sm:text-xs rounded-lg" : "h-10 text-base sm:text-sm rounded-xl"
          } bg-white pr-9 ${
            isEmerald ? "border-emerald-200" : "border-amber-200"
          }`}
        />

        {value.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear AfriMoney phone number"
            title="Clear phone number"
            className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p
        className={`${
          compact ? "text-[9px]" : "text-[10px]"
        } ${isEmerald ? "text-emerald-800" : "text-amber-800"}`}
      >
        {helperText}
      </p>
    </div>
  )
}

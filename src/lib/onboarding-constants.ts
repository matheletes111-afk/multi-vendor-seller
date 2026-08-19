/**
 * Standard referral source options for seller onboarding across all panels and mobile APIs.
 */
export const HEAR_ABOUT_US_OPTIONS = [
  "Google / Search Engine",
  "Social Media (Facebook, Instagram, TikTok)",
  "Facebook",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "YouTube / Online Video",
  "Friend, Family or Colleague Referral",
  "Word of Mouth",
  "Billboard / Outdoor Advertising",
  "TV / Radio / Print Ad",
  "Events / Trade Shows / Exhibitions",
  "Email Newsletter or Promotion",
  "Blog, News or Article",
  "Other"
] as const;

export type HearAboutUsOption = (typeof HEAR_ABOUT_US_OPTIONS)[number];

/**
 * Normalizes the submitted referral source.
 * If selected option is 'Other' and custom text is provided, returns 'Other: <custom_text>'.
 * If selected option is 'Other' and no custom text, returns 'Other'.
 * If custom text is provided directly without selected option, returns 'Other: <custom_text>'.
 */
export function formatHearAboutUs(
  selected?: string | null,
  otherText?: string | null
): string | null {
  const sel = selected?.trim() || null;
  const oth = otherText?.trim() || null;

  if (!sel && !oth) return null;

  if (sel === "Other") {
    return oth ? `Other: ${oth}` : "Other";
  }

  if (sel && /^Other:\s*/i.test(sel)) {
    return sel;
  }

  if (!sel && oth) {
    return `Other: ${oth}`;
  }

  return sel;
}

/**
 * Parses a saved hearAboutUs string into selected option and custom text.
 */
export function parseHearAboutUs(raw?: string | null): {
  selected: string;
  otherText: string;
} {
  if (!raw || !raw.trim()) {
    return { selected: "", otherText: "" };
  }

  const trimmed = raw.trim();

  // If it explicitly starts with "Other:" (case-insensitive)
  if (/^Other:\s*/i.test(trimmed)) {
    return {
      selected: "Other",
      otherText: trimmed.replace(/^Other:\s*/i, "").trim(),
    };
  }

  // If it is exactly "Other"
  if (trimmed.toLowerCase() === "other") {
    return {
      selected: "Other",
      otherText: "",
    };
  }

  // Check if it matches any predefined option
  const matched = HEAR_ABOUT_US_OPTIONS.find(
    (opt) => opt.toLowerCase() === trimmed.toLowerCase()
  );

  if (matched) {
    return {
      selected: matched,
      otherText: "",
    };
  }

  // Otherwise, it was custom text entered under "Other"
  return {
    selected: "Other",
    otherText: trimmed,
  };
}

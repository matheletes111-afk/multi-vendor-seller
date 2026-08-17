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

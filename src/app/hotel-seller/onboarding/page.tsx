import { Metadata } from "next"
import { HotelOnboardingClient } from "./onboarding-client"

export const metadata: Metadata = {
  title: "Hotel Seller Onboarding | Meeem",
  description: "Complete your hotel seller registration and onboarding.",
}

export default function HotelOnboardingPage() {
  return <HotelOnboardingClient />
}

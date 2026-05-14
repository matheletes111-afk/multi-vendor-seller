import { Metadata } from "next"
import { RestaurantOnboardingClient } from "./onboarding-client"

export const metadata: Metadata = {
  title: "Restaurant Seller Onboarding | Meeem Food",
  description: "Complete your restaurant seller registration and onboarding.",
}

export default function RestaurantOnboardingPage() {
  return <RestaurantOnboardingClient />
}

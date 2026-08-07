import { Metadata } from "next"
import { ServiceHomeClient } from "./service-home-client"

export const metadata: Metadata = {
  title: "Services | Book Verified On-Demand Services",
  description: "Browse and book top-rated, background-checked professional services. From home repairs and cleaning to beauty and wellness.",
}

export default function ServiceHomePage() {
  return <ServiceHomeClient />
}

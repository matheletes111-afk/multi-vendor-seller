import { Metadata } from "next"
import Link from "next/link"
import { PublicLayout } from "@/components/site-layout"

export const metadata: Metadata = {
  title: "Terms and Conditions | MEEEM Marketplace",
  description: "Terms and Conditions for using MEEEM Marketplace platform.",
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function TermsAndConditionsPage(props: PageProps) {
  const searchParams = await props.searchParams
  const isEmbed = searchParams.embed === "true"

  const content = (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-10 md:p-12">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Terms and Conditions
        </h1>
        <p className="mb-8 text-sm text-slate-500">
          Last Updated: July 10, 2026
        </p>

        <div className="prose prose-slate max-w-none text-slate-700 space-y-6">
          <p className="leading-relaxed">
            Welcome to MEEEM Marketplace. Please read these Terms and Conditions carefully before using our platform, which includes our website, mobile applications, and related e-commerce and services systems.
          </p>

          <hr className="my-6 border-slate-100" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing, browsing, or using MEEEM Marketplace (referred to as "the Platform," "we," "us," or "our"), you agree to be bound by these Terms and Conditions, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this Platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">2. User Accounts and Security</h2>
            <p className="leading-relaxed">
              To access certain features of the Platform (such as buying, listing products/services, booking hotels, or ordering food), you must register and maintain an active user account.
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>You must provide accurate, current, and complete information during registration.</li>
              <li>You are solely responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must notify us immediately of any unauthorized use of your account.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">3. Marketplace Transactions</h2>
            <p className="leading-relaxed">
              MEEEM Marketplace facilitates transactions between buyers and independent sellers (Product Sellers, Service Providers, Hotels, and Restaurants).
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong>Products & Services:</strong> Sellers are solely responsible for the description, pricing, availability, and delivery of their products or services.</li>
              <li><strong>Payments:</strong> All payments made through the Platform are processed securely via our authorized payment gateways. You agree to pay all charges incurred by your account at the prices in effect when such charges are incurred.</li>
              <li><strong>Food Orders:</strong> Food and delivery services are subject to preparation times and driver availability. Cancellation policies may apply based on restaurant status.</li>
              <li><strong>Hotel Bookings:</strong> Bookings are subject to the specific cancellation and refund policies of the hotel partner.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">4. User Conduct</h2>
            <p className="leading-relaxed">
              You agree to use the Platform only for lawful purposes. You are prohibited from:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Violating any local, national, or international laws or regulations.</li>
              <li>Posting false, inaccurate, misleading, defamatory, or libelous content.</li>
              <li>Distributing viruses, spam, or any other technologies that may harm the Platform or its users.</li>
              <li>Attempting to gain unauthorized access to the Platform's server or systems.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">5. Intellectual Property Rights</h2>
            <p className="leading-relaxed">
              All content on the Platform, including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software, is the property of MEEEM Marketplace or its content suppliers and is protected by international copyright and intellectual property laws.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">6. Limitation of Liability</h2>
            <p className="leading-relaxed">
              In no event shall MEEEM Marketplace, its directors, officers, employees, or agents be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or the inability to use the Platform, including transactions conducted with third-party sellers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">7. Changes to Terms</h2>
            <p className="leading-relaxed">
              We reserve the right to revise or update these Terms and Conditions at any time without prior notice. By continuing to use the Platform after changes are posted, you accept the modified terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">8. Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about these Terms and Conditions, please contact us at:
            </p>
            <div className="rounded-xl bg-slate-50 p-5 text-sm space-y-1 text-slate-600 border border-slate-100">
              <p className="font-semibold text-slate-800 text-base">MEEEM Marketplace</p>
              <p>Email: info@meeemsl.com / Support@meeemsl.com</p>
              <p>Address: Freetown, Sierra Leone</p>
            </div>
          </section>
        </div>

        {isEmbed && (
          <div className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} MEEEM Marketplace. Displayed in-app.
          </div>
        )}
      </div>
    </div>
  )

  if (isEmbed) {
    return <div className="min-h-screen bg-slate-50/50">{content}</div>
  }

  return <PublicLayout>{content}</PublicLayout>
}

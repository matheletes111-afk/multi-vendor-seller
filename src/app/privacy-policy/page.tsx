import { Metadata } from "next"
import Link from "next/link"
import { PublicLayout } from "@/components/site-layout"

export const metadata: Metadata = {
  title: "Privacy Policy | MEEEM Marketplace",
  description: "Privacy Policy outlining how we collect, use, and protect your data at MEEEM Marketplace.",
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PrivacyPolicyPage(props: PageProps) {
  const searchParams = await props.searchParams
  const isEmbed = searchParams.embed === "true"

  const content = (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-10 md:p-12">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mb-8 text-sm text-slate-500">
          Last Updated: July 10, 2026
        </p>

        <div className="prose prose-slate max-w-none text-slate-700 space-y-6">
          <p className="leading-relaxed">
            At MEEEM Marketplace (referred to as "MEEEM," "we," "our," or "us"), we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, mobile application, and transactional platforms.
          </p>

          <hr className="my-6 border-slate-100" />

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">1. Information We Collect</h2>
            <p className="leading-relaxed">
              We collect information to provide a better service to all our users. The types of personal information we collect include:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong>Account Registration Info:</strong> Name, email address, phone number, password, and details depending on your user role (Buyer, Seller, Rider).</li>
              <li><strong>Transaction Data:</strong> Details of products, food, hotel bookings, or services you buy or sell, payment receipts, and delivery details.</li>
              <li><strong>Location Data:</strong> Device location coordinates when you use our delivery/food service, to facilitate accurate dispatch and routing.</li>
              <li><strong>Usage and Device Info:</strong> IP address, operating system, browser type, device identifiers, and pages visited on the Platform.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">2. How We Use Your Information</h2>
            <p className="leading-relaxed">
              We process your personal information for purposes including:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>To create, manage, and secure your user or seller accounts.</li>
              <li>To process payments, fulfill orders, deliver packages, and manage hotel bookings.</li>
              <li>To improve our Platform's layout, algorithms, recommendation models, and customer service.</li>
              <li>To send you transactional updates, security alerts, and customer support messages.</li>
              <li>To comply with regulatory standards and legal duties.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">3. Information Sharing and Disclosure</h2>
            <p className="leading-relaxed">
              We do not sell your personal data. We share your information only under the following conditions:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong>With Sellers & Service Providers:</strong> To complete purchase transactions (e.g., sharing delivery address with the merchant/courier, or booking name with a hotel).</li>
              <li><strong>With Payment Processors:</strong> To complete financial transactions securely.</li>
              <li><strong>For Legal Reasons:</strong> If required by law, regulation, legal process, or governmental request to protect the rights and safety of the Platform or its users.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">4. Data Security</h2>
            <p className="leading-relaxed">
              We use industry-standard administrative, technical, and physical security measures (including secure databases, encryption protocols, and user validation filters) to protect your personal information. However, no transmission over the internet or storage method is 100% secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">5. Your Data Rights</h2>
            <p className="leading-relaxed">
              Depending on your location, you may have rights under local laws regarding your personal data, including the right to access, correct, or request the deletion of your personal data, or object to certain processing practices. You can manage your account settings or contact support to exercise these options.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">6. Cookies and Tracking</h2>
            <p className="leading-relaxed">
              We use cookies and similar tracking technologies to track platform activity, remember your session credentials and preferences (e.g., active cart items, theme styles), and maintain system security. You can manage cookie settings in your browser configuration.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">7. Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions or feedback about this Privacy Policy, please reach out to us at:
            </p>
            <div className="rounded-xl bg-slate-50 p-5 text-sm space-y-1 text-slate-600 border border-slate-100">
              <p className="font-semibold text-slate-800 text-base">MEEEM Marketplace Privacy Team</p>
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

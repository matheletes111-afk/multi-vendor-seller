export interface RiderLegalHighlight {
  icon: string
  title: string
  description: string
}

export interface RiderLegalSection {
  id: string
  number: string
  title: string
  summary?: string
  content: string
  bullets?: string[]
}

export interface RiderLegalDocument {
  id: string
  slug: string
  title: string
  version: string
  lastUpdated: string
  summary: string
  highlights: RiderLegalHighlight[]
  sections: RiderLegalSection[]
  content: string
  rawText: string
}

export const RIDER_TERMS_AND_CONDITIONS: RiderLegalDocument = {
  id: "rider-terms-and-conditions",
  slug: "rider-terms",
  title: "Delivery Partner & Rider Terms and Conditions",
  version: "1.0",
  lastUpdated: "September 2026",
  summary: "Comprehensive delivery partner agreement governing independent contractor status, onboarding verification, delivery protocol, weekly earnings, 100% tip pass-through, safety standards, and account conduct for MEEEM Marketplace couriers in Sierra Leone.",
  highlights: [
    {
      icon: "Wallet",
      title: "100% Tips Pass-Through",
      description: "Keep 100% of tips paid by customers in addition to standard delivery distance and base pay.",
    },
    {
      icon: "Clock",
      title: "Flexible Working Hours",
      description: "Operate on your own schedule with complete freedom to toggle Online or Offline at any time.",
    },
    {
      icon: "ShieldCheck",
      title: "Rider Safety & Support",
      description: "Dedicated courier safety assistance, real-time emergency protocol, and active order insurance.",
    },
    {
      icon: "Smartphone",
      title: "Direct Digital Payouts",
      description: "Automated settlements directly to your registered bank account or verified mobile money wallet.",
    },
  ],
  sections: [
    {
      id: "eligibility",
      number: "1",
      title: "Eligibility, Verification & Onboarding Requirements",
      summary: "Minimum legal standards, vehicle roadworthiness, and KYC identity verification required before activation.",
      content: "To register, operate, and maintain an active courier delivery profile on the MEEEM Platform, all delivery partners must satisfy the following verified standards:",
      bullets: [
        "Be at least 18 years of age at the date of registration.",
        "Possess a valid national identification document (National ID card, Voter's Card, or Passport) issued by the Government of Sierra Leone or authorized jurisdiction.",
        "Hold a valid and unexpired Driver's License corresponding to your vehicle classification (Motorcycle Class A, Light Motor Vehicle, or Commercial Delivery permit). Couriers operating pedal bicycles must verify proof of address and identity.",
        "Submit current vehicle registration documents and valid Roadworthiness / Fitness Certificates.",
        "Furnish proof of mandatory third-party motor vehicle insurance coverage where applicable.",
        "Successfully pass background verification and police clearance checks to ensure customer safety.",
        "Maintain a working smartphone running Android 8.0+ or iOS 13.0+ with cellular data, active GPS location hardware, and SMS/calling capability.",
      ],
    },
    {
      id: "contractor-status",
      number: "2",
      title: "Independent Contractor Relationship",
      summary: "Clear legal designation as an independent contractor with autonomous schedule management.",
      content: "The delivery partner acknowledges that their relationship with MEEEM E-Commerce Limited is solely that of an independent contractor and not an employee, agent, joint venturer, or partner. Consequently:",
      bullets: [
        "You retain absolute autonomy to decide when, where, and for how long you log into the MEEEM Rider App and provide delivery services.",
        "You have the unrestricted right to accept, decline, or ignore incoming delivery assignment dispatches without administrative penalties, subject only to orders not being cancelled after package collection.",
        "MEEEM does not dictate minimum weekly hours, uniforms, or exclusive service commitments; you may concurrently provide delivery services for other platforms.",
        "You are solely responsible for personal tax reporting, National Social Security and Insurance Trust (NASSIT) compliance, self-employed earnings declarations, and your own operating expenses (including fuel, mobile data, vehicle maintenance, and equipment).",
      ],
    },
    {
      id: "order-dispatch",
      number: "3",
      title: "Order Dispatch, Acceptance & Delivery Protocol",
      summary: "End-to-end fulfillment procedures from vendor pickup to customer drop-off.",
      content: "When fulfilling dispatch requests through the platform, riders agree to uphold the highest operational standards:",
      bullets: [
        "Prompt Merchant Arrival: Upon accepting a delivery offer, riders must proceed directly to the merchant establishment (retail store, restaurant, or hotel vendor) without unreasonable detours.",
        "Order Verification: Check order tokens, customer order IDs, and package counts with the merchant prior to confirming pickup in the Rider App.",
        "Insulated Bags for Food Deliveries: All restaurant and hot/cold food deliveries must be transported inside an approved, clean, insulated thermal delivery container to ensure hygiene and temperature control.",
        "Fragile Goods Handling: Handle retail goods, electronics, and delicate merchandise with extreme care to avoid drop damage or crushing.",
        "Customer Drop-Off & Verification: Deliver directly to the delivery address specified in the order. Verify recipient identity using the secure delivery PIN / OTP, digital signature, or photographic proof of delivery (POD).",
        "Contactless Delivery: Honor customer contactless drop-off requests by placing the package in a safe location and uploading clear photographic proof of delivery in the app.",
      ],
    },
    {
      id: "compensation",
      number: "4",
      title: "Rider Compensation, Tips & Payout Schedule",
      summary: "Transparent fee structure, surge pricing, 100% tip guarantee, and mobile money settlements.",
      content: "MEEEM compensates delivery partners transparently based on trip metrics and customer appreciation:",
      bullets: [
        "Base Delivery Fee: A fixed base fee applied to every successfully completed delivery pickup and dispatch.",
        "Distance Compensation: Additional per-kilometer compensation calculated using actual GPS route metrics from merchant to destination.",
        "Wait Time Allowance: Supplementary compensation when merchant order preparation exceeds standard threshold waiting windows.",
        "Surge & Weather Incentives: Dynamic fare multipliers applied during peak demand hours, holidays, or inclement weather conditions.",
        "100% Customer Tips: 100% of any tip amount added by the customer via credit card, debit card, or mobile money is transferred entirely to the courier with ZERO platform deductions.",
        "Settlement Cycles: Earnings are deposited on a weekly cycle (or on-demand express payout where enabled) to the rider's verified Orange Money, Africell Money, or domestic bank account.",
        "Cash on Delivery (COD) Compliance: When handling authorized Cash-on-Delivery orders, riders must accurately collect the exact cash total and deposit platform dues to designated collection channels within 24 hours.",
      ],
    },
    {
      id: "equipment-safety",
      number: "5",
      title: "Equipment, Road Safety & Traffic Regulations",
      summary: "Mandatory helmet use, road traffic laws, and zero tolerance for reckless driving.",
      content: "Safety of couriers, pedestrians, and the public is paramount across all MEEEM logistics operations:",
      bullets: [
        "Protective Gear: Two-wheeler motorcycle couriers must wear an approved, undamaged safety helmet with the chin strap fastened at all times while operating the vehicle.",
        "Traffic Compliance: Couriers must obey all traffic laws, speed regulations, traffic lights, lane designations, and road signs in Sierra Leone.",
        "Vehicle Roadworthiness: Regularly inspect brakes, tires, headlamps, mirrors, and indicator lights to guarantee optimal vehicle safety.",
        "Substance Prohibition: Operating a delivery vehicle under the influence of alcohol, narcotics, prescription sedatives, or recreational drugs results in immediate permanent ban and criminal referral.",
        "No Mobile Distraction: Handheld use of mobile phones while moving is strictly prohibited. Mount smartphones securely on vehicle handlebar phone holders.",
      ],
    },
    {
      id: "cancellation-delays",
      number: "6",
      title: "Cancellations, Road Emergencies & Reassignment",
      summary: "Procedures for unforeseen road incidents, breakdowns, and cancellation limits.",
      content: "Guidelines for managing interruptions and unexpected events during transit:",
      bullets: [
        "Emergency Notification: In the event of an accident, mechanical breakdown, severe weather, or road blockages, riders must promptly use the in-app Emergency / Help button to inform Dispatch Support.",
        "Package Safeguarding: The courier remains responsible for preserving the integrity of goods in transit until reassignment or safe return to the merchant.",
        "Cancellations Prior to Pickup: Couriers may decline orders before arrival without penalty; however, repeated frequent declines after acceptance may temporarily limit dispatch priority.",
        "Prohibited Cancellation After Pickup: Unilateral order cancellation after collecting packages from the vendor is strictly prohibited and constitutes presumptive theft, leading to immediate account deactivation unless verified by support.",
      ],
    },
    {
      id: "code-of-conduct",
      number: "7",
      title: "Code of Conduct & Customer Interaction",
      summary: "Professionalism, anti-harassment, customer privacy protection, and parcel sanctity.",
      content: "All MEEEM couriers serve as the primary human face of the platform and must uphold top professional ethics:",
      bullets: [
        "Courtesy & Respect: Maintain a polite, respectful demeanor when interacting with customers, merchant personnel, and fellow delivery riders.",
        "Strict Anti-Harassment: Zero tolerance for verbal abuse, sexual advances, inappropriate messages, intimidation, or discriminatory remarks based on gender, ethnicity, religion, or disability.",
        "Package Sanctity: Opening, tampering with, inspecting, sampling, or consuming any portion of customer food or packaged items is strictly forbidden.",
        "Customer Confidentiality: Customer contact details (phone numbers and delivery addresses) provided within the Rider App are strictly for completing the current order. Storing, contacting, or contacting customers after delivery completion is an actionable breach of privacy.",
      ],
    },
    {
      id: "deactivation",
      number: "8",
      title: "Account Suspension, Deactivation & Appeals",
      summary: "Performance benchmarks, fraud prevention grounds, and fair dispute review process.",
      content: "To protect community integrity, MEEEM reserves the right to suspend or terminate partner accounts for cause:",
      bullets: [
        "Grounds for Deactivation: Fraudulent activity (GPS spoofing, fake delivery completions, falsified mileage), unremitted cash collections, criminal offenses, abusive behavior, and tampering with goods.",
        "Quality Thresholds: Consistent customer rating drops below the minimum quality threshold (4.2 out of 5.0 stars) over 50 consecutive trips will trigger a mandatory quality review.",
        "Notice & Explanation: Upon suspension or deactivation, riders will receive electronic notice outlining the reason and evidence considered.",
        "Appeals Process: Couriers have the right to file a written appeal with the MEEEM Partner Appeals Board within 14 days of deactivation, providing supporting evidence or testimony for review.",
      ],
    },
    {
      id: "liability-insurance",
      number: "9",
      title: "Insurance, Limitation of Liability & Indemnity",
      summary: "Allocation of risks, independent vehicle insurance obligations, and liability boundaries.",
      content: "Understanding legal rights and responsibilities regarding damages, third-party claims, and insurance:",
      bullets: [
        "Primary Vehicle Insurance: Couriers must maintain their own statutory third-party road insurance covering damage, injury, or loss arising from the operation of their vehicle.",
        "Platform Protection: MEEEM may provide supplementary platform transit coverage for eligible goods during active dispatch; however, this does not replace statutory motor insurance.",
        "Limitation of Liability: To the maximum extent permitted by Sierra Leone law, MEEEM is not liable for indirect, incidental, or consequential damages resulting from courier vehicular incidents.",
        "Indemnification: Couriers agree to indemnify and hold harmless MEEEM E-Commerce Limited, its officers, and affiliates from claims resulting from reckless driving, statutory violations, or willful misconduct.",
      ],
    },
    {
      id: "governing-law",
      number: "10",
      title: "Governing Law, Amendments & Contact Desk",
      summary: "Jurisdiction of Sierra Leone courts and communication channels for courier questions.",
      content: "Legal framework and amendment notices governing this agreement:",
      bullets: [
        "Governing Law: These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of Sierra Leone.",
        "Dispute Resolution: Any controversy or claim arising out of or relating to this agreement shall first be addressed through good-faith mediation before the Sierra Leone Chamber of Commerce or an agreed mediator before court proceedings.",
        "Policy Updates: MEEEM may amend these terms periodically. Notice of material updates will be delivered via in-app banner or registered email. Continued use of the Rider App after notification constitutes agreement.",
        "Support & Help Desk: For contract inquiries, courier disputes, or clarifications, contact: support@meeemsl.com or riders@meeemsl.com, MEEEM E-Commerce Limited, Freetown, Sierra Leone.",
      ],
    },
  ],
  content: `<div class="legal-document">
  <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Delivery Partner & Rider Terms and Conditions</h1>
  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">MEEEM MARKETPLACE DELIVERY PARTNER AGREEMENT</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">Last Updated: September 2026 | Version: 1.0</p>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">Welcome to the MEEEM Delivery Network. These Delivery Partner & Rider Terms and Conditions ("Agreement") govern your engagement as an independent delivery courier providing logistics and courier services via the MEEEM platform across web and mobile applications.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">1. Eligibility, Verification & Onboarding Requirements</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">To operate as a verified delivery rider, couriers must meet strict onboarding verification standards:</p>
  <ul style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0; padding-left: 20px;">
    <li>Be at least 18 years of age at registration.</li>
    <li>Hold valid government-issued photo identification (National ID, Passport, or Voter's Card).</li>
    <li>Provide an active Driver's License appropriate for your vehicle category.</li>
    <li>Submit valid vehicle registration, fitness certificate, and roadworthiness documentation.</li>
    <li>Maintain an active smartphone with high-precision GPS capabilities and mobile data connectivity.</li>
  </ul>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">2. Independent Contractor Relationship</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">You act as an autonomous independent service contractor. You enjoy full flexibility to choose your own hours, log online or offline at will, and accept or decline incoming delivery requests.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">3. Order Fulfillment & Delivery Protocols</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">Couriers are required to verify package counts with merchants, use insulated thermal delivery bags for restaurant orders, handle fragile retail goods with utmost care, and capture proof of delivery (OTP or photo verification) upon customer handoff.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">4. Rider Compensation, Tips & Weekly Payouts</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">Earnings include base pickup pay, distance-based travel compensation, and peak surge bonuses. 100% of customer tips are passed directly to the rider with zero platform deductions. Settlements are disbursed weekly to your verified bank account or mobile money wallet.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">5. Road Safety & Traffic Compliance</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">Mandatory helmet usage is enforced for all motorcycle riders. Couriers must strictly comply with Sierra Leone road traffic codes and refrain from handheld phone use while in transit. Driving under the influence of substances is strictly prohibited.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">6. Customer Care & Code of Conduct</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">Maintain courteous communication, zero tolerance for harassment or discrimination, and absolute parcel sanctity. Never tamper with or consume customer food or items. Customer contact information must remain strictly confidential and never used outside the delivery order.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">7. Governing Law</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">This agreement is governed by the laws of the Republic of Sierra Leone. For inquiries or dispute resolution, contact support@meeemsl.com.</p>
</div>`,
  rawText: `DELIVERY PARTNER & RIDER TERMS AND CONDITIONS
MEEEM MARKETPLACE DELIVERY PARTNER AGREEMENT
Last Updated: September 2026 | Version: 1.0

1. Eligibility, Verification & Onboarding
Riders must be at least 18 years old, possess valid government ID, a valid driver's license, vehicle registration, roadworthiness certificates, and a GPS-enabled smartphone.

2. Independent Contractor Relationship
Delivery partners are independent contractors with complete schedule flexibility to go Online or Offline whenever they choose.

3. Order Dispatch & Delivery Protocols
Riders must verify orders at merchant pickups, use clean thermal insulated bags for food, handle delicate items carefully, and obtain proof of delivery (OTP/photo) upon drop-off.

4. Earnings, 100% Tips & Payouts
Rider pay includes base fees, distance calculations, and peak bonuses. 100% of customer tips belong directly to the rider with zero platform commission. Weekly payouts via Mobile Money or Bank Transfer.

5. Road Safety & Compliance
Mandatory helmet wearing for two-wheelers, strict compliance with traffic regulations, and zero tolerance for substance abuse or distracted driving.

6. Code of Conduct & Customer Privacy
Professional and courteous behavior at all times. Opening, tampering, or consuming customer orders is strictly prohibited. Customer phone numbers and addresses are strictly confidential.

7. Governing Law
Governed by the laws of the Republic of Sierra Leone. Contact: support@meeemsl.com`,
}

export const RIDER_PRIVACY_POLICY: RiderLegalDocument = {
  id: "rider-privacy-policy",
  slug: "rider-privacy",
  title: "Delivery Partner & Rider Privacy Policy",
  version: "1.0",
  lastUpdated: "September 2026",
  summary: "Comprehensive privacy disclosures detailing continuous background GPS location tracking, KYC identity verification data, payout credentials, call proxy logs, and courier data rights under Sierra Leone data protection laws.",
  highlights: [
    {
      icon: "MapPin",
      title: "Background GPS Tracking",
      description: "Continuous location collection while Online to assign nearby orders and calculate precise route ETA.",
    },
    {
      icon: "Lock",
      title: "Encrypted Payout Details",
      description: "Bank details and mobile money wallet numbers are encrypted at rest with military-grade AES-256.",
    },
    {
      icon: "PhoneCall",
      title: "Masked Number Privacy",
      description: "Phone numbers are masked when contacting customers to protect courier personal phone privacy.",
    },
    {
      icon: "UserCheck",
      title: "Your Data Rights",
      description: "Full rights to access, inspect, export earnings logs, or request account and data deletion.",
    },
  ],
  sections: [
    {
      id: "scope-intro",
      number: "1",
      title: "Scope & Purpose of this Policy",
      summary: "Applicability to delivery drivers, bicycle couriers, and logistics partners.",
      content: "This Rider Privacy Policy explains how MEEEM E-Commerce Limited collects, uses, processes, stores, and protects personal, operational, and geographical information of delivery partners using the MEEEM Rider Mobile Application and courier management dashboards.",
      bullets: [
        "Applies to all registered delivery partners, courier applicants, and active delivery contractors.",
        "Governs mobile device permissions, telemetry data, background services, and real-time location monitoring.",
        "Complements the platform-wide Privacy Policy while providing disclosures unique to transport operations.",
      ],
    },
    {
      id: "information-collected",
      number: "2",
      title: "Information We Collect from Couriers",
      summary: "Categorized breakdown of personal, vehicular, financial, and technical data collected.",
      content: "To maintain a secure, efficient, and compliant logistics ecosystem, MEEEM collects specific categories of courier data:",
      bullets: [
        "Personal & Contact Identity: Full legal name, date of birth, residential address, profile photograph, telephone number, and emergency contact details.",
        "Verification & KYC Documents: National identification numbers (NIN/Passport/Voter ID), copies of Driver's License, background check clearance, and vehicle ownership / insurance documents.",
        "Vehicle Information: Vehicle make, model, year, color, registration license plate number, and carrying capacity.",
        "Financial & Payout Information: Bank account number, Bank Verification details, or registered Mobile Money phone number (Orange Money / Africell Money) for processing earnings settlements.",
        "Operational Logs: Delivery acceptance times, cancellation logs, completion rates, customer feedback ratings, and route distance.",
        "Device & Technical Data: Device manufacturer, hardware model, operating system version, unique device tokens, push notification keys, and network connectivity.",
      ],
    },
    {
      id: "background-location",
      number: "3",
      title: "Background Location Tracking Disclosure",
      summary: "Critical disclosure on why and when continuous background location services are required.",
      content: "MEEEM Rider App collects real-time, high-precision location data (latitude, longitude, heading, altitude, and speed) under specific operational parameters:",
      bullets: [
        "Continuous Background Tracking: Location data is collected continuously while the Rider App is running in the foreground, minimized in the background, or when the mobile device screen is locked, PROVIDED the rider status is toggled to 'ONLINE' or an active delivery order is in progress.",
        "Dispatch Matching: Background location is used to calculate proximity to nearby restaurants and stores, assigning orders to the nearest couriers to minimize customer waiting time.",
        "Customer Live Tracking: During an active delivery assignment, live GPS coordinates are streamed securely to the ordering customer and merchant to provide real-time map tracking and accurate estimated arrival time (ETA).",
        "Mileage & Payout Auditing: Precise GPS tracking guarantees accurate calculation of distance-based delivery compensation and provides verification in the event of dispute.",
        "Safety & SOS Dispatch: In case of roadside emergencies or prolonged inactivity during an active order, location data enables rapid emergency response dispatch.",
        "Termination of Tracking: Location collection immediately CEASES when the courier toggles their status to 'OFFLINE' in the Rider App or signs out of their account.",
      ],
    },
    {
      id: "data-usage",
      number: "4",
      title: "How We Use Courier Information",
      summary: "Operational, financial, algorithmic, and legal uses of collected data.",
      content: "MEEEM utilizes your information for legitimate, disclosed business purposes:",
      bullets: [
        "Creating and authenticating your Rider account profile and credentials.",
        "Matching incoming customer orders with your current location and route direction.",
        "Calculating gross earnings, bonuses, distance allowances, customer tips, and processing payouts.",
        "Facilitating communication between you, merchant staff, and customers via proxy call or chat masking.",
        "Detecting and preventing fraudulent conduct, including GPS spoofing, fake location apps, and identity sharing.",
        "Improving navigation accuracy, algorithm efficiency, and delivery time estimations.",
        "Complying with statutory reporting requirements under the laws of Sierra Leone.",
      ],
    },
    {
      id: "data-sharing",
      number: "5",
      title: "Information Sharing & Third-Party Disclosures",
      summary: "Who receives courier information and under what operational circumstances.",
      content: "We protect courier privacy and share data only when necessary to complete orders or fulfill legal mandates:",
      bullets: [
        "Ordering Customers: During an active order, customers see the rider's first name, vehicle type, vehicle plate number, profile photo, and real-time live map location until drop-off completion.",
        "Merchant Partners: Merchants see the assigned rider's name and estimated arrival time to prepare packages accordingly.",
        "Payment Processors: Secure transmission of payment instructions to commercial banks and mobile money operators to disburse weekly earnings.",
        "Emergency Services & Police: In cases involving road accidents, violent crimes, or valid legal warrants issued by Sierra Leone judicial authorities.",
        "No Sale of Data: MEEEM does NOT sell, rent, monetize, or disclose rider personal data or location histories to third-party marketing companies.",
      ],
    },
    {
      id: "security-retention",
      number: "6",
      title: "Data Security Standards & Retention Policy",
      summary: "Encryption protocols, role-based access restrictions, and retention limits.",
      content: "Rigorous technical measures safeguard rider records against unauthorized interception:",
      bullets: [
        "Encryption in Transit & Rest: All location streams and sensitive records utilize TLS 1.3 encryption in transit and AES-256 database encryption at rest.",
        "Access Restriction: Courier documents and financial data are accessible only by authorized compliance and safety officers on a need-to-know basis.",
        "Retention Schedule: Operational delivery records and financial transaction receipts are retained for up to 5 years in compliance with Sierra Leone revenue and commercial audit standards.",
        "Location History Pruning: High-frequency raw GPS waypoint trails are systematically aggregated and pruned within 90 days after delivery completion, preserving only total distance and route milestones.",
      ],
    },
    {
      id: "rights-deletion",
      number: "7",
      title: "Courier Data Rights & Account Deletion",
      summary: "Empowering couriers to inspect records and request permanent data removal.",
      content: "Delivery partners retain comprehensive rights regarding their personal information:",
      bullets: [
        "Right to Access & Review: Inspect your personal profile, vehicle records, and earnings statements directly in the Rider App settings.",
        "Right to Rectification: Request immediate correction of outdated phone numbers, vehicle registrations, or bank accounts via the Rider Support desk.",
        "Right to Account & Data Deletion: Couriers may permanently terminate their account and request personal data deletion at any time via the MEEEM Account Deletion page (/delete-account) or in-app support.",
        "Post-Deletion Anonymization: Upon account deletion, personal identifiers are permanently scrubbed, leaving only anonymized financial figures required by statutory tax regulations.",
      ],
    },
    {
      id: "contact-dpo",
      number: "8",
      title: "Data Protection Officer & Privacy Inquiries",
      summary: "Official contact points for privacy compliance and grievance redressal.",
      content: "For questions, concerns, or formal data access requests regarding this Rider Privacy Policy, please contact our dedicated Privacy Desk:",
      bullets: [
        "Data Protection Officer: MEEEM E-Commerce Limited Legal & Compliance Department",
        "Courier Privacy Email: privacy@meeemsl.com / support@meeemsl.com",
        "Physical Office: MEEEM Marketplace HQ, Freetown, Sierra Leone",
        "Response Timeline: The Compliance Department acknowledges all courier privacy inquiries within 48 business hours.",
      ],
    },
  ],
  content: `<div class="legal-document">
  <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Delivery Partner & Rider Privacy Policy</h1>
  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">MEEEM COURIER DATA PROTECTION & PRIVACY NOTICE</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">Last Updated: September 2026 | Version: 1.0</p>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">This Rider Privacy Policy governs the collection, use, location tracking, and protection of personal data belonging to delivery partners using the MEEEM Rider Mobile App and courier tools.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">1. Information We Collect</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">We collect identity information (name, phone, email, NIN, photo), KYC vehicle records (driver's license, registration, roadworthiness), financial information (mobile money wallet or bank account for payouts), and technical device diagnostics.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">2. Background Location Tracking Disclosure</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">The MEEEM Rider App collects real-time high-precision GPS location even when the app is in the background or screen is locked, solely when the courier is 'ONLINE' or fulfilling an active order. This enables accurate dispatch matching, live tracking for customers and merchants, route mileage pay calculation, and emergency roadside safety. Location collection immediately stops when toggled 'OFFLINE'.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">3. Data Sharing & Security</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">Customers see only your first name, vehicle details, and active route map. We never sell your personal data. All data is encrypted with TLS 1.3 and AES-256.</p>

  <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 16px 0 8px 0;">4. Your Rights & Data Deletion</h2>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 6px 0;">You can inspect earnings records, update information, or request account deletion at any time through the MEEEM Account Deletion Portal (/delete-account). Contact: privacy@meeemsl.com.</p>
</div>`,
  rawText: `DELIVERY PARTNER & RIDER PRIVACY POLICY
MEEEM COURIER DATA PROTECTION & PRIVACY NOTICE
Last Updated: September 2026 | Version: 1.0

1. Information We Collect
We collect personal identity (name, phone, NIN, photo), vehicle documentation (license, registration), payout details (mobile money or bank account), and device diagnostics.

2. Background Location Tracking Disclosure
The Rider App collects real-time GPS location continuously in the background while the courier is marked ONLINE or completing an active order. This enables order matching, live customer tracking, mileage pay calculation, and courier safety. Tracking stops when marked OFFLINE.

3. Sharing & Security
Customers only see rider first name, vehicle info, and live map during delivery. Personal data is never sold. Data is secured using TLS 1.3 and AES-256 encryption.

4. Courier Rights & Deletion
Riders have full rights to review records and request permanent account and data deletion via /delete-account. Contact: privacy@meeemsl.com, Freetown, Sierra Leone.`,
}

export function getRiderLegalDocument(type: "terms" | "privacy" | "all" = "all") {
  if (type === "terms") {
    return { terms: RIDER_TERMS_AND_CONDITIONS }
  }
  if (type === "privacy") {
    return { privacy: RIDER_PRIVACY_POLICY }
  }
  return {
    terms: RIDER_TERMS_AND_CONDITIONS,
    privacy: RIDER_PRIVACY_POLICY,
  }
}

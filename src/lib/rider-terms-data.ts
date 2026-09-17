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
  title: "MEEEM Rider and Driver Employment Terms and Conditions",
  version: "1.0",
  lastUpdated: "September 2026",
  summary: "Operational responsibilities, conduct, road safety and loss accountability governing employed riders and drivers for MEEEM E-Commerce Limited under the laws of Sierra Leone and Employment Act 2023.",
  highlights: [
    {
      icon: "ShieldCheck",
      title: "Fair Loss Accountability",
      description: "No arbitrary deductions or penalties; responsibility for documented loss applies only upon fair investigation establishing gross negligence or fraud.",
    },
    {
      icon: "Clock",
      title: "Core Delivery Standards",
      description: "Punctual reporting, complete chain-of-custody verification, safe route management, and verified proof of delivery.",
    },
    {
      icon: "CheckCircle2",
      title: "Vehicle & Road Safety",
      description: "Strict compliance with traffic laws, mandatory helmet and seatbelt use, daily pre-checks, and zero tolerance for impairment (alcohol, kush, or drugs).",
    },
    {
      icon: "FileText",
      title: "5-Day Review Right",
      description: "Written notice of findings and loss amounts with the legal right to request an internal review within five working days.",
    },
  ],
  sections: [
    {
      id: "appointment-and-status",
      number: "1",
      title: "Appointment and Status",
      summary: "Employment arrangement under Sierra Leone law and signed appointment terms.",
      content: "The worker is employed by MEEEM in the role stated in their appointment documentation (Rider, Driver, or Logistics Personnel), subject to any probation, working hours, place of work, remuneration, leave, benefits and notice terms stated in the signed appointment letter or employment contract. Nothing in these Terms removes a statutory entitlement or permits an unlawful deduction, penalty or dismissal.",
    },
    {
      id: "core-responsibilities",
      number: "2",
      title: "Core Responsibilities",
      summary: "Daily operational expectations from shift start to delivery completion.",
      content: "All employed riders and drivers must adhere to the following professional delivery standards:",
      bullets: [
        "Report for duty on time, fit for work, properly dressed and with required identification, protective equipment, licence and documents.",
        "Accept and complete assigned deliveries diligently, using the authorised App and dispatch process. Follow reasonable and lawful instructions from MEEEM.",
        "Check that the order or parcel count, packaging and visible condition match the pickup record. Do not open sealed goods unless authorised.",
        "Use the safest reasonable route, protect goods from theft, damage, heat, rain, contamination and unauthorised access, and never leave goods unattended except through an approved handover process.",
        "Verify the recipient and complete proof of delivery as required. Never mark an order delivered before actual handover.",
        "Handle cash, electronic payments, refunds and receipts strictly under MEEEM procedures. Never use customer or company money personally or delay remittance.",
        "Keep customers, merchants and dispatch informed of delays, failed delivery attempts, accidents, damaged packaging, safety risks and emergencies.",
        "Treat customers, merchants, colleagues and members of the public respectfully and without harassment, threats, discrimination or abusive language.",
        "Protect customer, merchant and MEEEM information and use it only for assigned work.",
        "Return undelivered goods, company property, cash, documents, keys and devices promptly in the condition required by policy.",
      ],
    },
    {
      id: "vehicle-and-road-safety",
      number: "3",
      title: "Vehicle and Road Safety",
      summary: "Licensing, pre-use inspections, protective gear, and accident reporting.",
      content: "Safety of riders, drivers, goods, and members of the public is paramount across all operations:",
      bullets: [
        "Hold and maintain the correct valid licence and any legally required permits. Immediately report suspension, expiry, restriction or loss.",
        "Conduct required pre-use checks on tyres, brakes, lights, mirrors, fuel, load restraints, helmet, seat belt and other safety equipment.",
        "Obey traffic laws, speed limits, load limits and parking rules. A helmet and other required protective equipment must be worn for motorcycles. Seat belts must be used where fitted.",
        "Do not drive while impaired by alcohol, kush, illegal drugs, sedating medication, exhaustion or illness. Do not use a handheld phone while the vehicle is moving.",
        "Carry no unauthorised passenger, goods, weapon or hazardous item. Do not allow another person to use the worker's account, assigned vehicle or company property.",
        "Immediately stop safely, seek medical or police help where appropriate, protect the scene and report every accident, injury, theft or material damage to MEEEM. Do not admit liability or privately settle a company-related claim without authority.",
      ],
    },
    {
      id: "app-gps-and-account-rules",
      number: "4",
      title: "App, GPS and Account Rules",
      summary: "Authorized credentials, live device permissions, and security integrity.",
      content: "The worker must use only their assigned account, keep login credentials confidential, maintain a charged and functioning approved device, enable required permissions during duty, and ensure delivery updates are accurate. Location spoofing, false proof of delivery, unauthorised account sharing, deletion of relevant records or interference with monitoring and security features is prohibited. Use of the App is also governed by the MEEEM Delivery App Privacy Policy.",
    },
    {
      id: "goods-cash-and-chain-of-custody",
      number: "5",
      title: "Goods, Cash and Chain of Custody",
      summary: "Clear custody boundaries from merchant handover to recipient acceptance.",
      content: "Responsibility for an item begins when the worker accepts custody in the App or signs the pickup record and ends when an authorised recipient, return desk or other authorised person accepts it with the required proof. The worker must not substitute, consume, borrow, sell, pledge or tamper with goods. Any discrepancy must be recorded before leaving the pickup point when reasonably possible.",
    },
    {
      id: "carelessness-losses-and-refunds",
      number: "6",
      title: "Carelessness, Losses and Refunds",
      summary: "Investigation-backed liability standards distinguishing fault from external events.",
      content: "Liability for direct documented losses or customer refunds is strictly bounded by fairness and factual investigation:",
      bullets: [
        "The worker may be held responsible for a direct and reasonably documented loss or customer refund only where a fair investigation establishes, on the available evidence, that the loss was caused by the worker's fraud, theft, wilful misconduct, gross negligence or failure to exercise reasonable care or follow a clear and lawful procedure.",
        "Examples of actionable default include: leaving goods unattended, handing goods to the wrong person without required verification, unauthorised use of funds, reckless driving, falsifying delivery evidence, or failing to return undelivered goods.",
        "The worker will not be responsible merely because a loss occurred. MEEEM will consider packaging failure, incorrect merchant information, customer fraud, robbery or accident despite reasonable precautions, unsafe instructions, system failure, normal wear and tear, and other circumstances outside the worker's reasonable control.",
      ],
    },
    {
      id: "investigation-and-recovery-procedure",
      number: "7",
      title: "Investigation and Recovery Procedure",
      summary: "Step-by-step due process, evidentiary review, written outcomes, and appeal rights.",
      content: "Where a loss, damage, or delivery default is investigated, MEEEM applies the following standard procedure:",
      bullets: [
        "MEEEM will secure available evidence, which may include App records, GPS, photographs, receipts, customer or merchant statements, vehicle records and the worker's report.",
        "The worker will receive written notice of the allegation and the proposed loss amount, and a reasonable opportunity to respond and provide evidence or witnesses.",
        "MEEEM will issue a written outcome stating the finding, evidence considered, amount of proven direct loss, any shared responsibility, and any disciplinary or recovery action.",
        "The worker may request an internal review within five working days of receiving the outcome, or within a longer period allowed by company policy or law.",
        "Recovery may be made by voluntary repayment, an agreed instalment plan, insurance, or another method permitted by law. Any deduction from wages requires the worker's written consent for the specific lawful deduction or other clear legal authority, and must comply with statutory limits. MEEEM will not impose an arbitrary fine or recover indirect, speculative or punitive amounts.",
        "Serious misconduct may lead to disciplinary action up to dismissal, but only through the procedure required by the employment contract, company policy and applicable law. Suspected crime may be reported to the appropriate authority.",
      ],
    },
    {
      id: "performance-and-attendance",
      number: "8",
      title: "Performance and Attendance",
      summary: "Rosters, attendance expectations, training, and mitigating circumstances.",
      content: "The worker must follow rosters, attendance and leave procedures, maintain reasonable delivery performance, attend required training and respond to operational communications. Genuine safety conditions, authorised leave, disability accommodation, verified App failures and events outside the worker's reasonable control must be considered before adverse action.",
    },
    {
      id: "confidentiality-and-data-protection",
      number: "9",
      title: "Confidentiality and Data Protection",
      summary: "Obligation to safeguard all customer, merchant, and operational information.",
      content: "During and after employment, the worker must keep confidential all non-public information about customers, merchants, pricing, routes, orders, security, staff, technology and business operations. Information may be disclosed only for authorised work, with MEEEM's permission or where legally required. Company records must be returned or securely deleted when instructed.",
    },
    {
      id: "company-property-and-personal-vehicle-use",
      number: "10",
      title: "Company Property and Personal Vehicle Use",
      summary: "Care of vehicles, devices, bags, and rules for approved personal vehicle usage.",
      content: "Company vehicles, devices, uniforms, cards, bags and equipment remain MEEEM property and must be used only as authorised. The worker must promptly report loss or damage and return property on request or termination. If a personal vehicle is approved, the worker must keep it roadworthy, insured and licensed as required, and must not represent that MEEEM owns or insures it unless confirmed in writing.",
    },
    {
      id: "prohibited-conduct",
      number: "11",
      title: "Prohibited Conduct",
      summary: "Zero-tolerance violations resulting in immediate disciplinary proceedings.",
      content: "The following activities are strictly prohibited and constitute grounds for immediate disciplinary action:",
      bullets: [
        "Theft, fraud, bribery, extortion, unauthorised fees, deliberate overcharging or diversion of orders.",
        "Violence, harassment, discrimination, sexual misconduct, intimidation or retaliation.",
        "Possession or use of illegal drugs while working, alcohol impairment, dangerous driving or deliberate safety violations.",
        "False records, fake delivery completion, account sharing, GPS manipulation or destruction of evidence.",
        "Unauthorised disclosure or use of customer information, photographs, contacts, payment details or delivery addresses.",
      ],
    },
    {
      id: "complaints-discipline-and-non-retaliation",
      number: "12",
      title: "Complaints, Discipline and Non-Retaliation",
      summary: "Whistleblower protection and safe reporting channels for workplace concerns.",
      content: "A worker should promptly report unsafe instructions, harassment, fraud, payment concerns, privacy incidents or other wrongdoing through a supervisor, Human Resources or the official support channel. MEEEM will review reports fairly and will not retaliate against a worker for making a good-faith report or participating honestly in an investigation.",
    },
    {
      id: "end-of-employment",
      number: "13",
      title: "End of Employment",
      summary: "Notice periods, final settlement, property return, and post-termination surviving terms.",
      content: "Termination, resignation, notice, final pay and return of property will be handled under the signed employment contract and Sierra Leone law. Confidentiality, protection of personal information, return of property, and responsibility for a finally established lawful debt survive termination to the extent permitted by law.",
    },
    {
      id: "governing-law-and-changes",
      number: "14",
      title: "Governing Law and Changes",
      summary: "Jurisdiction of Sierra Leone and legal protection under the Employment Act 2023.",
      content: "These Terms are governed by the laws of Sierra Leone, including the Employment Act 2023 and other applicable road-safety, cybersecurity and criminal laws. MEEEM may update operational rules after reasonable notice, but no update may reduce a mandatory legal right or change a core employment term without the process or agreement required by law.",
    },
    {
      id: "acknowledgement",
      number: "15",
      title: "Acknowledgement and Execution",
      summary: "Formal confirmation of receipt, review, understanding, and agreement.",
      content: "By signing or digitally accepting, the worker confirms that these Terms and the Delivery App Privacy Policy were provided, explained where necessary, and understood; that the worker had an opportunity to ask questions; and that the worker agrees to follow them. Signing does not waive any right that cannot lawfully be waived.",
    },
  ],
  content: `<div class="legal-document space-y-6">
    <div class="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
      <h1 class="text-2xl font-black text-slate-900 dark:text-slate-100">MEEEM Rider and Driver Employment Terms and Conditions</h1>
      <p class="text-sm font-semibold text-violet-600 dark:text-violet-400 mt-1">Operational responsibilities, conduct, safety and loss accountability</p>
      <p class="text-xs text-slate-500 mt-1">Governed by the laws of Sierra Leone, including the Employment Act 2023</p>
    </div>

    <div class="bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 rounded-2xl p-4 text-xs text-violet-900 dark:text-violet-200 leading-relaxed">
      These Terms form part of the employment arrangement between <strong>MEEEM E-Commerce Limited</strong> and the rider or driver. They set the minimum standards for safe, honest and reliable delivery work. They do not replace the worker's appointment letter, compensation schedule, workplace policies or rights under Sierra Leone law; where there is a conflict, mandatory law prevails.
    </div>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">1. Appointment and Status</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">The worker is employed by MEEEM in the role stated in their appointment documentation, subject to any probation, working hours, place of work, remuneration, leave, benefits and notice terms stated in the signed appointment letter or employment contract. Nothing in these Terms removes a statutory entitlement or permits an unlawful deduction, penalty or dismissal.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">2. Core Responsibilities</h2>
    <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      <li>Report for duty on time, fit for work, properly dressed and with required identification, protective equipment, licence and documents.</li>
      <li>Accept and complete assigned deliveries diligently, using the authorised App and dispatch process. Follow reasonable and lawful instructions from MEEEM.</li>
      <li>Check that the order or parcel count, packaging and visible condition match the pickup record. Do not open sealed goods unless authorised.</li>
      <li>Use the safest reasonable route, protect goods from theft, damage, heat, rain, contamination and unauthorised access, and never leave goods unattended except through an approved handover process.</li>
      <li>Verify the recipient and complete proof of delivery as required. Never mark an order delivered before actual handover.</li>
      <li>Handle cash, electronic payments, refunds and receipts strictly under MEEEM procedures. Never use customer or company money personally or delay remittance.</li>
      <li>Keep customers, merchants and dispatch informed of delays, failed delivery attempts, accidents, damaged packaging, safety risks and emergencies.</li>
      <li>Treat customers, merchants, colleagues and members of the public respectfully and without harassment, threats, discrimination or abusive language.</li>
      <li>Protect customer, merchant and MEEEM information and use it only for assigned work.</li>
      <li>Return undelivered goods, company property, cash, documents, keys and devices promptly in the condition required by policy.</li>
    </ul>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">3. Vehicle and Road Safety</h2>
    <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      <li>Hold and maintain the correct valid licence and any legally required permits. Immediately report suspension, expiry, restriction or loss.</li>
      <li>Conduct required pre-use checks on tyres, brakes, lights, mirrors, fuel, load restraints, helmet, seat belt and other safety equipment.</li>
      <li>Obey traffic laws, speed limits, load limits and parking rules. A helmet and other required protective equipment must be worn for motorcycles. Seat belts must be used where fitted.</li>
      <li>Do not drive while impaired by alcohol, kush, illegal drugs, sedating medication, exhaustion or illness. Do not use a handheld phone while the vehicle is moving.</li>
      <li>Carry no unauthorised passenger, goods, weapon or hazardous item. Do not allow another person to use the worker's account, assigned vehicle or company property.</li>
      <li>Immediately stop safely, seek medical or police help where appropriate, protect the scene and report every accident, injury, theft or material damage to MEEEM. Do not admit liability or privately settle a company-related claim without authority.</li>
    </ul>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">4. App, GPS and Account Rules</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">The worker must use only their assigned account, keep login credentials confidential, maintain a charged and functioning approved device, enable required permissions during duty, and ensure delivery updates are accurate. Location spoofing, false proof of delivery, unauthorised account sharing, deletion of relevant records or interference with monitoring and security features is prohibited. Use of the App is also governed by the MEEEM Delivery App Privacy Policy.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">5. Goods, Cash and Chain of Custody</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Responsibility for an item begins when the worker accepts custody in the App or signs the pickup record and ends when an authorised recipient, return desk or other authorised person accepts it with the required proof. The worker must not substitute, consume, borrow, sell, pledge or tamper with goods. Any discrepancy must be recorded before leaving the pickup point when reasonably possible.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">6. Carelessness, Losses and Refunds</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">The worker may be held responsible for a direct and reasonably documented loss or customer refund only where a fair investigation establishes, on the available evidence, that the loss was caused by the worker's fraud, theft, wilful misconduct, gross negligence or failure to exercise reasonable care or follow a clear and lawful procedure. Examples may include leaving goods unattended, handing goods to the wrong person without required verification, unauthorised use of funds, reckless driving, falsifying delivery evidence, or failing to return undelivered goods.</p>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">The worker will not be responsible merely because a loss occurred. MEEEM will consider packaging failure, incorrect merchant information, customer fraud, robbery or accident despite reasonable precautions, unsafe instructions, system failure, normal wear and tear, and other circumstances outside the worker's reasonable control.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">7. Investigation and Recovery Procedure</h2>
    <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      <li>MEEEM will secure available evidence, which may include App records, GPS, photographs, receipts, customer or merchant statements, vehicle records and the worker's report.</li>
      <li>The worker will receive written notice of the allegation and the proposed loss amount, and a reasonable opportunity to respond and provide evidence or witnesses.</li>
      <li>MEEEM will issue a written outcome stating the finding, evidence considered, amount of proven direct loss, any shared responsibility, and any disciplinary or recovery action.</li>
      <li>The worker may request an internal review within five working days of receiving the outcome, or within a longer period allowed by company policy or law.</li>
      <li>Recovery may be made by voluntary repayment, an agreed instalment plan, insurance, or another method permitted by law. Any deduction from wages requires the worker's written consent for the specific lawful deduction or other clear legal authority, and must comply with statutory limits. MEEEM will not impose an arbitrary fine or recover indirect, speculative or punitive amounts.</li>
      <li>Serious misconduct may lead to disciplinary action up to dismissal, but only through the procedure required by the employment contract, company policy and applicable law. Suspected crime may be reported to the appropriate authority.</li>
    </ul>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">8. Performance and Attendance</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">The worker must follow rosters, attendance and leave procedures, maintain reasonable delivery performance, attend required training and respond to operational communications. Genuine safety conditions, authorised leave, disability accommodation, verified App failures and events outside the worker's reasonable control must be considered before adverse action.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">9. Confidentiality and Data Protection</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">During and after employment, the worker must keep confidential all non-public information about customers, merchants, pricing, routes, orders, security, staff, technology and business operations. Information may be disclosed only for authorised work, with MEEEM's permission or where legally required. Company records must be returned or securely deleted when instructed.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">10. Company Property and Personal Vehicle Use</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Company vehicles, devices, uniforms, cards, bags and equipment remain MEEEM property and must be used only as authorised. The worker must promptly report loss or damage and return property on request or termination. If a personal vehicle is approved, the worker must keep it roadworthy, insured and licensed as required, and must not represent that MEEEM owns or insures it unless confirmed in writing.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">11. Prohibited Conduct</h2>
    <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      <li>Theft, fraud, bribery, extortion, unauthorised fees, deliberate overcharging or diversion of orders.</li>
      <li>Violence, harassment, discrimination, sexual misconduct, intimidation or retaliation.</li>
      <li>Possession or use of illegal drugs while working, alcohol impairment, dangerous driving or deliberate safety violations.</li>
      <li>False records, fake delivery completion, account sharing, GPS manipulation or destruction of evidence.</li>
      <li>Unauthorised disclosure or use of customer information, photographs, contacts, payment details or delivery addresses.</li>
    </ul>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">12. Complaints, Discipline and Non-Retaliation</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">A worker should promptly report unsafe instructions, harassment, fraud, payment concerns, privacy incidents or other wrongdoing through a supervisor, Human Resources or the official support channel. MEEEM will review reports fairly and will not retaliate against a worker for making a good-faith report or participating honestly in an investigation.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">13. End of Employment</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Termination, resignation, notice, final pay and return of property will be handled under the signed employment contract and Sierra Leone law. Confidentiality, protection of personal information, return of property, and responsibility for a finally established lawful debt survive termination to the extent permitted by law.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">14. Governing Law and Changes</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">These Terms are governed by the laws of Sierra Leone, including the Employment Act 2023 and other applicable road-safety, cybersecurity and criminal laws. MEEEM may update operational rules after reasonable notice, but no update may reduce a mandatory legal right or change a core employment term without the process or agreement required by law.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">15. Acknowledgement</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">By signing, the worker confirms that these Terms and the Delivery App Privacy Policy were provided, explained where necessary, and understood; that the worker had an opportunity to ask questions; and that the worker agrees to follow them. Signing does not waive any right that cannot lawfully be waived.</p>
  </div>`,
  rawText: `MEEEM Rider and Driver Employment Terms and Conditions
Operational responsibilities, conduct, safety and loss accountability

These Terms form part of the employment arrangement between MEEEM E-Commerce Limited and the rider or driver. They set the minimum standards for safe, honest and reliable delivery work. They do not replace the worker's appointment letter, compensation schedule, workplace policies or rights under Sierra Leone law; where there is a conflict, mandatory law prevails.

1 Appointment and status
The worker is employed by MEEEM in the role stated above, subject to any probation, working hours, place of work, remuneration, leave, benefits and notice terms stated in the signed appointment letter or employment contract. Nothing in these Terms removes a statutory entitlement or permits an unlawful deduction, penalty or dismissal.

2 Core responsibilities
- Report for duty on time, fit for work, properly dressed and with required identification, protective equipment, licence and documents.
- Accept and complete assigned deliveries diligently, using the authorised App and dispatch process. Follow reasonable and lawful instructions from MEEEM.
- Check that the order or parcel count, packaging and visible condition match the pickup record. Do not open sealed goods unless authorised.
- Use the safest reasonable route, protect goods from theft, damage, heat, rain, contamination and unauthorised access, and never leave goods unattended except through an approved handover process.
- Verify the recipient and complete proof of delivery as required. Never mark an order delivered before actual handover.
- Handle cash, electronic payments, refunds and receipts strictly under MEEEM procedures. Never use customer or company money personally or delay remittance.
- Keep customers, merchants and dispatch informed of delays, failed delivery attempts, accidents, damaged packaging, safety risks and emergencies.
- Treat customers, merchants, colleagues and members of the public respectfully and without harassment, threats, discrimination or abusive language.
- Protect customer, merchant and MEEEM information and use it only for assigned work.
- Return undelivered goods, company property, cash, documents, keys and devices promptly in the condition required by policy.

3 Vehicle and road safety
- Hold and maintain the correct valid licence and any legally required permits. Immediately report suspension, expiry, restriction or loss.
- Conduct required pre-use checks on tyres, brakes, lights, mirrors, fuel, load restraints, helmet, seat belt and other safety equipment.
- Obey traffic laws, speed limits, load limits and parking rules. A helmet and other required protective equipment must be worn for motorcycles. Seat belts must be used where fitted.
- Do not drive while impaired by alcohol, kush, illegal drugs, sedating medication, exhaustion or illness. Do not use a handheld phone while the vehicle is moving.
- Carry no unauthorised passenger, goods, weapon or hazardous item. Do not allow another person to use the worker's account, assigned vehicle or company property.
- Immediately stop safely, seek medical or police help where appropriate, protect the scene and report every accident, injury, theft or material damage to MEEEM. Do not admit liability or privately settle a company-related claim without authority.

4 App, GPS and account rules
The worker must use only their assigned account, keep login credentials confidential, maintain a charged and functioning approved device, enable required permissions during duty, and ensure delivery updates are accurate. Location spoofing, false proof of delivery, unauthorised account sharing, deletion of relevant records or interference with monitoring and security features is prohibited. Use of the App is also governed by the MEEEM Delivery App Privacy Policy.

5 Goods, cash and chain of custody
Responsibility for an item begins when the worker accepts custody in the App or signs the pickup record and ends when an authorised recipient, return desk or other authorised person accepts it with the required proof. The worker must not substitute, consume, borrow, sell, pledge or tamper with goods. Any discrepancy must be recorded before leaving the pickup point when reasonably possible.

6 Carelessness, losses and refunds
The worker may be held responsible for a direct and reasonably documented loss or customer refund only where a fair investigation establishes, on the available evidence, that the loss was caused by the worker's fraud, theft, wilful misconduct, gross negligence or failure to exercise reasonable care or follow a clear and lawful procedure. Examples may include leaving goods unattended, handing goods to the wrong person without required verification, unauthorised use of funds, reckless driving, falsifying delivery evidence, or failing to return undelivered goods.
The worker will not be responsible merely because a loss occurred. MEEEM will consider packaging failure, incorrect merchant information, customer fraud, robbery or accident despite reasonable precautions, unsafe instructions, system failure, normal wear and tear, and other circumstances outside the worker's reasonable control.

7 Investigation and recovery procedure
- MEEEM will secure available evidence, which may include App records, GPS, photographs, receipts, customer or merchant statements, vehicle records and the worker's report.
- The worker will receive written notice of the allegation and the proposed loss amount, and a reasonable opportunity to respond and provide evidence or witnesses.
- MEEEM will issue a written outcome stating the finding, evidence considered, amount of proven direct loss, any shared responsibility, and any disciplinary or recovery action.
- The worker may request an internal review within five working days of receiving the outcome, or within a longer period allowed by company policy or law.
- Recovery may be made by voluntary repayment, an agreed instalment plan, insurance, or another method permitted by law. Any deduction from wages requires the worker's written consent for the specific lawful deduction or other clear legal authority, and must comply with statutory limits. MEEEM will not impose an arbitrary fine or recover indirect, speculative or punitive amounts.
- Serious misconduct may lead to disciplinary action up to dismissal, but only through the procedure required by the employment contract, company policy and applicable law. Suspected crime may be reported to the appropriate authority.

8 Performance and attendance
The worker must follow rosters, attendance and leave procedures, maintain reasonable delivery performance, attend required training and respond to operational communications. Genuine safety conditions, authorised leave, disability accommodation, verified App failures and events outside the worker's reasonable control must be considered before adverse action.

9 Confidentiality and data protection
During and after employment, the worker must keep confidential all non-public information about customers, merchants, pricing, routes, orders, security, staff, technology and business operations. Information may be disclosed only for authorised work, with MEEEM's permission or where legally required. Company records must be returned or securely deleted when instructed.

10 Company property and personal vehicle use
Company vehicles, devices, uniforms, cards, bags and equipment remain MEEEM property and must be used only as authorised. The worker must promptly report loss or damage and return property on request or termination. If a personal vehicle is approved, the worker must keep it roadworthy, insured and licensed as required, and must not represent that MEEEM owns or insures it unless confirmed in writing.

11 Prohibited conduct
- Theft, fraud, bribery, extortion, unauthorised fees, deliberate overcharging or diversion of orders.
- Violence, harassment, discrimination, sexual misconduct, intimidation or retaliation.
- Possession or use of illegal drugs while working, alcohol impairment, dangerous driving or deliberate safety violations.
- False records, fake delivery completion, account sharing, GPS manipulation or destruction of evidence.
- Unauthorised disclosure or use of customer information, photographs, contacts, payment details or delivery addresses.

12 Complaints, discipline and non retaliation
A worker should promptly report unsafe instructions, harassment, fraud, payment concerns, privacy incidents or other wrongdoing through a supervisor, Human Resources or the official support channel. MEEEM will review reports fairly and will not retaliate against a worker for making a good-faith report or participating honestly in an investigation.

13 End of employment
Termination, resignation, notice, final pay and return of property will be handled under the signed employment contract and Sierra Leone law. Confidentiality, protection of personal information, return of property, and responsibility for a finally established lawful debt survive termination to the extent permitted by law.

14 Governing law and changes
These Terms are governed by the laws of Sierra Leone, including the Employment Act 2023 and other applicable road-safety, cybersecurity and criminal laws. MEEEM may update operational rules after reasonable notice, but no update may reduce a mandatory legal right or change a core employment term without the process or agreement required by law.

15 Acknowledgement
By signing, the worker confirms that these Terms and the Delivery App Privacy Policy were provided, explained where necessary, and understood; that the worker had an opportunity to ask questions; and that the worker agrees to follow them. Signing does not waive any right that cannot lawfully be waived.`,
}

export const RIDER_PRIVACY_POLICY: RiderLegalDocument = {
  id: "rider-privacy-policy",
  slug: "rider-privacy",
  title: "MEEEM Delivery App Privacy Policy",
  version: "1.0",
  lastUpdated: "September 2026",
  summary: "Comprehensive privacy disclosures governing personal data collection, background GPS route tracking, employment administration, data sharing, and worker privacy rights under the laws of Sierra Leone.",
  highlights: [
    {
      icon: "MapPin",
      title: "On-Duty GPS Location",
      description: "Precise location is tracked exclusively while logged in and on active delivery duty. No tracking occurs when logged out and off-duty.",
    },
    {
      icon: "Lock",
      title: "Worker Privacy Rights",
      description: "You have the right to inspect, correct, and request deletion of personal information no longer required by law, with zero retaliation.",
    },
    {
      icon: "ShieldCheck",
      title: "Human Review Guaranteed",
      description: "Automated routing or safety flags are never used as the sole basis for employment decisions without human investigation and right of explanation.",
    },
    {
      icon: "EyeOff",
      title: "No Data Selling",
      description: "MEEEM never sells worker data. Sharing is strictly limited to customers, merchants, and verified payment/mapping infrastructure partners.",
    },
  ],
  sections: [
    {
      id: "scope-and-acceptance",
      number: "1",
      title: "Scope and Acceptance",
      summary: "Who this policy covers and how it integrates with your employment contract.",
      content: "This Privacy Policy explains how MEEEM E-Commerce Limited (MEEEM, we, us or our) collects, uses, stores and shares personal information when an employed rider or driver uses the MEEEM Delivery App or performs delivery duties. It applies to applicants, currently employed riders and drivers, and former riders and drivers whose information remains in MEEEM records. It applies to information collected through the App, MEEEM devices and systems, onboarding, support, dispatch, deliveries, safety investigations and employment administration. It should be read with the employment agreement, workplace rules and any customer-facing privacy notice.",
    },
    {
      id: "information-we-collect",
      number: "2",
      title: "Information We Collect",
      summary: "Categories of personal, identity, location, vehicle, and operational data collected.",
      content: "MEEEM collects the following categories of data in connection with your courier duties:",
      bullets: [
        "Identity and contact: Name, photograph, date of birth, address, telephone number, email, emergency contact, national identity or passport information and employee number.",
        "Eligibility and checks: Driver's licence, vehicle licence and insurance, right-to-work information, references, training records and lawful background or safety checks.",
        "Precise location and route: GPS position, route, pickup and drop-off points, timestamps, distance, speed or movement indicators, and proof of arrival. Location may be collected in the background while the worker is logged in, on duty or completing an active delivery.",
        "Delivery and customer interaction: Order identifiers, collection and delivery status, proof of delivery, recipient name or signature, photographs where required, masked or recorded communications where enabled, complaints and support records.",
        "Device and app: Device model, operating system, app version, IP address, device identifiers, login records, diagnostics, crash logs and security events.",
        "Employment and payment: Contract details, attendance, schedules, performance, earnings, reimbursements, deductions lawfully authorised, bank or mobile-money details and tax or statutory contribution information.",
        "Safety and incident: Accident reports, vehicle inspections, damage or loss reports, witness statements, photographs and investigation outcomes.",
      ],
    },
    {
      id: "how-we-collect-information",
      number: "3",
      title: "How We Collect Information",
      summary: "Direct input, automatic sensors/GPS, and third-party operational sources.",
      content: "Information is gathered through three primary channels:",
      bullets: [
        "Directly from the worker during application, onboarding, use of the App and communication with MEEEM.",
        "Automatically from the App, assigned devices, vehicle systems or security tools when enabled.",
        "From customers, merchants, dispatchers, insurers, public authorities, reference providers and service providers where lawful and relevant.",
      ],
    },
    {
      id: "why-we-use-information",
      number: "4",
      title: "Why We Use Information",
      summary: "Operational purposes including dispatch routing, safety, payroll, and statutory compliance.",
      content: "Your data is used strictly for legitimate business, operational, and legal purposes:",
      bullets: [
        "To verify identity, eligibility, licences, training and fitness for assigned duties.",
        "To assign, route, monitor and confirm deliveries; calculate distance, time, pay and reimbursements; and provide real-time delivery updates.",
        "To protect customers, workers, goods, funds, vehicles and MEEEM systems; prevent fraud; investigate accidents, losses, complaints and suspected misconduct.",
        "To manage employment, attendance, performance, payroll, benefits, training, discipline, grievances and termination.",
        "To communicate operational, safety, support and emergency information.",
        "To comply with employment, tax, social-security, court, law-enforcement, cybersecurity and other legal obligations, and to establish or defend legal claims.",
        "To analyse and improve delivery performance, service reliability, capacity planning and App security using the minimum information reasonably needed.",
      ],
    },
    {
      id: "location-monitoring-and-automated-tools",
      number: "5",
      title: "Location Monitoring and Automated Tools",
      summary: "Background GPS tracking policies during active shifts and limits on automated decisions.",
      content: "Location tracking is strictly tied to duty periods, with safeguards against off-duty surveillance:",
      bullets: [
        "Precise location is essential during duty periods and active deliveries. MEEEM will not intentionally track a worker through the App while the worker is logged out and off duty, unless a company device, vehicle or item is reported lost or stolen and tracking is reasonably necessary and lawful.",
        "The worker must follow device settings and must not disable, falsify or manipulate required location data.",
        "MEEEM may use rules or analytics to flag unusual routes, delays, safety events or suspected fraud.",
        "A significant employment decision will never be based solely on an automated flag without appropriate human review and an opportunity for the worker to explain relevant circumstances.",
      ],
    },
    {
      id: "sharing-of-information",
      number: "6",
      title: "Sharing of Information",
      summary: "Customer delivery updates, service partners, and statutory authorities. Zero selling of data.",
      content: "MEEEM may share only the information reasonably necessary with customers and merchants (for example, first name, photograph, vehicle details, live arrival information and delivery status); affiliated MEEEM operations; payment, mapping, communications, cloud, identity-verification, insurance and professional-service providers; and regulators, courts, police or other authorities where required or lawfully requested. Information may also be shared in a corporate restructuring or sale subject to appropriate confidentiality safeguards. MEEEM does not sell workers' personal information.",
    },
    {
      id: "international-storage-and-service-providers",
      number: "7",
      title: "International Storage and Service Providers",
      summary: "Contractual and technical safeguards for cross-border cloud infrastructure.",
      content: "Some technology providers or servers may be located outside Sierra Leone. Where information is transferred internationally, MEEEM will use reasonable contractual, technical and organisational safeguards and limit access to the purposes described in this Policy.",
    },
    {
      id: "retention",
      number: "8",
      title: "Retention",
      summary: "Retention schedules for payroll, location data, eligibility, and incident records.",
      content: "Information is retained only for as long as necessary under law and policy:",
      bullets: [
        "Active employment and payroll: Kept during employment and afterwards for the period required by law, audit, tax, benefit, dispute or claim needs.",
        "Delivery and location: Kept only as long as reasonably needed for service records, customer complaints, fraud prevention, safety, audit and legal claims, then deleted or de-identified.",
        "Identity and eligibility: Reviewed and retained while required to establish identity, eligibility and compliance.",
        "Incident and investigation: Kept until the matter and any related claim, appeal or statutory period are closed.",
      ],
    },
    {
      id: "security",
      number: "9",
      title: "Security",
      summary: "Encryption, access controls, backups, and breach notification responsibilities.",
      content: "MEEEM uses reasonable access controls, authentication, encryption where appropriate, logging, backups, staff confidentiality duties and vendor safeguards. No system is completely secure. A worker must immediately report a lost device, compromised account, suspicious message or unauthorised disclosure, and must not share passwords, customer information or delivery records.",
    },
    {
      id: "worker-rights-and-choices",
      number: "10",
      title: "Worker Rights and Choices",
      summary: "Access, correction, deletion, and appeal procedures via official channels.",
      content: "Subject to applicable law and legitimate operational or legal restrictions, a worker may ask to access or correct personal information, raise a concern about its use, request deletion of information no longer required, or ask for review of a significant automated decision. A request may be made through the App support channel, the worker's supervisor or the official contact channel published at www.meeemsl.com. Identity verification may be required. MEEEM will not retaliate against a good-faith privacy concern.",
    },
    {
      id: "customer-information-handled-by-workers",
      number: "11",
      title: "Customer Information Handled by Workers",
      summary: "Confidentiality rules for recipient contact details, addresses, and order contents.",
      content: "Customer and merchant information shown in the App is confidential and may be used only to complete the assigned delivery. A worker must not copy, photograph, retain, publish, contact for personal reasons, or disclose that information except as authorised by MEEEM or required by law.",
    },
    {
      id: "children",
      number: "12",
      title: "Children",
      summary: "Adult workforce policy and legal age requirements.",
      content: "The Delivery App is for authorised adult workers. MEEEM does not knowingly employ or create Delivery App accounts for persons below the lawful working or driving age.",
    },
    {
      id: "changes-and-contact",
      number: "13",
      title: "Changes and Contact",
      summary: "Notification of policy updates and official support points of contact.",
      content: "MEEEM may update this Policy to reflect changes in the App, operations or law. Material changes will be communicated through the App, workplace notice or another appropriate channel before or when they take effect. Questions or complaints may be submitted through the App support channel, a supervisor, or the official contact details published at www.meeemsl.com.",
    },
    {
      id: "governing-standards",
      number: "14",
      title: "Governing Standards",
      summary: "Applicable legal frameworks of Sierra Leone and prevailing worker protections.",
      content: "This Policy is governed by applicable laws of Sierra Leone, including employment, communications, cybersecurity and privacy-related requirements. If a mandatory law gives a worker greater protection than this Policy, that law prevails.",
    },
  ],
  content: `<div class="legal-document space-y-6">
    <div class="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
      <h1 class="text-2xl font-black text-slate-900 dark:text-slate-100">MEEEM Delivery App Privacy Policy</h1>
      <p class="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">For employed riders and drivers</p>
      <p class="text-xs text-slate-500 mt-1">Compliant with the laws of Sierra Leone and mobile platform standards</p>
    </div>

    <div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
      This Privacy Policy explains how <strong>MEEEM E-Commerce Limited (MEEEM, we, us or our)</strong> collects, uses, stores and shares personal information when an employed rider or driver uses the MEEEM Delivery App or performs delivery duties. It also explains the worker's choices and responsibilities. The App may require location, identity and delivery information to operate safely and reliably.
    </div>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">1. Scope and Acceptance</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">This Policy applies to applicants, employed riders and drivers, and former riders and drivers whose information remains in MEEEM records. It applies to information collected through the App, MEEEM devices and systems, onboarding, support, dispatch, deliveries, safety investigations and employment administration. It should be read with the employment agreement, workplace rules and any customer-facing privacy notice.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">2. Information We Collect</h2>
    <div class="space-y-2 text-xs text-slate-600 dark:text-slate-400">
      <p><strong>Identity and contact:</strong> Name, photograph, date of birth, address, telephone number, email, emergency contact, national identity or passport information and employee number.</p>
      <p><strong>Eligibility and checks:</strong> Driver's licence, vehicle licence and insurance, right-to-work information, references, training records and lawful background or safety checks.</p>
      <p><strong>Precise location and route:</strong> GPS position, route, pickup and drop-off points, timestamps, distance, speed or movement indicators, and proof of arrival. Location may be collected in the background while the worker is logged in, on duty or completing an active delivery.</p>
      <p><strong>Delivery and customer interaction:</strong> Order identifiers, collection and delivery status, proof of delivery, recipient name or signature, photographs where required, masked or recorded communications where enabled, complaints and support records.</p>
      <p><strong>Device and app:</strong> Device model, operating system, app version, IP address, device identifiers, login records, diagnostics, crash logs and security events.</p>
      <p><strong>Employment and payment:</strong> Contract details, attendance, schedules, performance, earnings, reimbursements, deductions lawfully authorised, bank or mobile-money details and tax or statutory contribution information.</p>
      <p><strong>Safety and incident:</strong> Accident reports, vehicle inspections, damage or loss reports, witness statements, photographs and investigation outcomes.</p>
    </div>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">3. How We Collect Information</h2>
    <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      <li>Directly from the worker during application, onboarding, use of the App and communication with MEEEM.</li>
      <li>Automatically from the App, assigned devices, vehicle systems or security tools when enabled.</li>
      <li>From customers, merchants, dispatchers, insurers, public authorities, reference providers and service providers where lawful and relevant.</li>
    </ul>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">4. Why We Use Information</h2>
    <ul class="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      <li>To verify identity, eligibility, licences, training and fitness for assigned duties.</li>
      <li>To assign, route, monitor and confirm deliveries; calculate distance, time, pay and reimbursements; and provide real-time delivery updates.</li>
      <li>To protect customers, workers, goods, funds, vehicles and MEEEM systems; prevent fraud; investigate accidents, losses, complaints and suspected misconduct.</li>
      <li>To manage employment, attendance, performance, payroll, benefits, training, discipline, grievances and termination.</li>
      <li>To communicate operational, safety, support and emergency information.</li>
      <li>To comply with employment, tax, social-security, court, law-enforcement, cybersecurity and other legal obligations, and to establish or defend legal claims.</li>
      <li>To analyse and improve delivery performance, service reliability, capacity planning and App security using the minimum information reasonably needed.</li>
    </ul>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">5. Location Monitoring and Automated Tools</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">Precise location is essential during duty periods and active deliveries. MEEEM will not intentionally track a worker through the App while the worker is logged out and off duty, unless a company device, vehicle or item is reported lost or stolen and tracking is reasonably necessary and lawful. The worker must follow device settings and must not disable, falsify or manipulate required location data.</p>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">MEEEM may use rules or analytics to flag unusual routes, delays, safety events or suspected fraud. A significant employment decision should not be based solely on an automated flag without appropriate human review and an opportunity for the worker to explain relevant circumstances.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">6. Sharing of Information</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">MEEEM may share only the information reasonably necessary with customers and merchants (for example, first name, photograph, vehicle details, live arrival information and delivery status); affiliated MEEEM operations; payment, mapping, communications, cloud, identity-verification, insurance and professional-service providers; and regulators, courts, police or other authorities where required or lawfully requested. Information may also be shared in a corporate restructuring or sale subject to appropriate confidentiality safeguards. <strong>MEEEM does not sell workers' personal information.</strong></p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">7. International Storage and Service Providers</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Some technology providers or servers may be located outside Sierra Leone. Where information is transferred internationally, MEEEM will use reasonable contractual, technical and organisational safeguards and limit access to the purposes described in this Policy.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">8. Retention</h2>
    <div class="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      <p><strong>Active employment and payroll:</strong> Kept during employment and afterwards for the period required by law, audit, tax, benefit, dispute or claim needs.</p>
      <p><strong>Delivery and location:</strong> Kept only as long as reasonably needed for service records, customer complaints, fraud prevention, safety, audit and legal claims, then deleted or de-identified.</p>
      <p><strong>Identity and eligibility:</strong> Reviewed and retained while required to establish identity, eligibility and compliance.</p>
      <p><strong>Incident and investigation:</strong> Kept until the matter and any related claim, appeal or statutory period are closed.</p>
    </div>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">9. Security</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">MEEEM uses reasonable access controls, authentication, encryption where appropriate, logging, backups, staff confidentiality duties and vendor safeguards. No system is completely secure. A worker must immediately report a lost device, compromised account, suspicious message or unauthorised disclosure, and must not share passwords, customer information or delivery records.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">10. Worker Rights and Choices</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Subject to applicable law and legitimate operational or legal restrictions, a worker may ask to access or correct personal information, raise a concern about its use, request deletion of information no longer required, or ask for review of a significant automated decision. A request may be made through the App support channel, the worker's supervisor or the official contact channel published at www.meeemsl.com. Identity verification may be required. MEEEM will not retaliate against a good-faith privacy concern.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">11. Customer Information Handled by Workers</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Customer and merchant information shown in the App is confidential and may be used only to complete the assigned delivery. A worker must not copy, photograph, retain, publish, contact for personal reasons, or disclose that information except as authorised by MEEEM or required by law.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">12. Children</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">The Delivery App is for authorised adult workers. MEEEM does not knowingly employ or create Delivery App accounts for persons below the lawful working or driving age.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">13. Changes and Contact</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">MEEEM may update this Policy to reflect changes in the App, operations or law. Material changes will be communicated through the App, workplace notice or another appropriate channel before or when they take effect. Questions or complaints may be submitted through the App support channel, a supervisor, or the official contact details published at www.meeemsl.com.</p>

    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">14. Governing Standards</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">This Policy is governed by applicable laws of Sierra Leone, including employment, communications, cybersecurity and privacy-related requirements. If a mandatory law gives a worker greater protection than this Policy, that law prevails.</p>
  </div>`,
  rawText: `MEEEM Delivery App Privacy Policy
For employed riders and drivers

This Privacy Policy explains how MEEEM E-Commerce Limited (MEEEM, we, us or our) collects, uses, stores and shares personal information when an employed rider or driver uses the MEEEM Delivery App or performs delivery duties. It also explains the worker's choices and responsibilities. The App may require location, identity and delivery information to operate safely and reliably.

1 Scope and acceptance
This Policy applies to applicants, employed riders and drivers, and former riders and drivers whose information remains in MEEEM records. It applies to information collected through the App, MEEEM devices and systems, onboarding, support, dispatch, deliveries, safety investigations and employment administration. It should be read with the employment agreement, workplace rules and any customer-facing privacy notice.

2 Information we collect
- Identity and contact: Name, photograph, date of birth, address, telephone number, email, emergency contact, national identity or passport information and employee number.
- Eligibility and checks: Driver's licence, vehicle licence and insurance, right-to-work information, references, training records and lawful background or safety checks.
- Precise location and route: GPS position, route, pickup and drop-off points, timestamps, distance, speed or movement indicators, and proof of arrival. Location may be collected in the background while the worker is logged in, on duty or completing an active delivery.
- Delivery and customer interaction: Order identifiers, collection and delivery status, proof of delivery, recipient name or signature, photographs where required, masked or recorded communications where enabled, complaints and support records.
- Device and app: Device model, operating system, app version, IP address, device identifiers, login records, diagnostics, crash logs and security events.
- Employment and payment: Contract details, attendance, schedules, performance, earnings, reimbursements, deductions lawfully authorised, bank or mobile-money details and tax or statutory contribution information.
- Safety and incident: Accident reports, vehicle inspections, damage or loss reports, witness statements, photographs and investigation outcomes.

3 How we collect information
- Directly from the worker during application, onboarding, use of the App and communication with MEEEM.
- Automatically from the App, assigned devices, vehicle systems or security tools when enabled.
- From customers, merchants, dispatchers, insurers, public authorities, reference providers and service providers where lawful and relevant.

4 Why we use information
- To verify identity, eligibility, licences, training and fitness for assigned duties.
- To assign, route, monitor and confirm deliveries; calculate distance, time, pay and reimbursements; and provide real-time delivery updates.
- To protect customers, workers, goods, funds, vehicles and MEEEM systems; prevent fraud; investigate accidents, losses, complaints and suspected misconduct.
- To manage employment, attendance, performance, payroll, benefits, training, discipline, grievances and termination.
- To communicate operational, safety, support and emergency information.
- To comply with employment, tax, social-security, court, law-enforcement, cybersecurity and other legal obligations, and to establish or defend legal claims.
- To analyse and improve delivery performance, service reliability, capacity planning and App security using the minimum information reasonably needed.

5 Location monitoring and automated tools
- Precise location is essential during duty periods and active deliveries. MEEEM will not intentionally track a worker through the App while the worker is logged out and off duty, unless a company device, vehicle or item is reported lost or stolen and tracking is reasonably necessary and lawful. The worker must follow device settings and must not disable, falsify or manipulate required location data.
- MEEEM may use rules or analytics to flag unusual routes, delays, safety events or suspected fraud. A significant employment decision should not be based solely on an automated flag without appropriate human review and an opportunity for the worker to explain relevant circumstances.

6 Sharing of information
MEEEM may share only the information reasonably necessary with customers and merchants (for example, first name, photograph, vehicle details, live arrival information and delivery status); affiliated MEEEM operations; payment, mapping, communications, cloud, identity-verification, insurance and professional-service providers; and regulators, courts, police or other authorities where required or lawfully requested. Information may also be shared in a corporate restructuring or sale subject to appropriate confidentiality safeguards. MEEEM does not sell workers' personal information.

7 International storage and service providers
Some technology providers or servers may be located outside Sierra Leone. Where information is transferred internationally, MEEEM will use reasonable contractual, technical and organisational safeguards and limit access to the purposes described in this Policy.

8 Retention
- Active employment and payroll: Kept during employment and afterwards for the period required by law, audit, tax, benefit, dispute or claim needs.
- Delivery and location: Kept only as long as reasonably needed for service records, customer complaints, fraud prevention, safety, audit and legal claims, then deleted or de-identified.
- Identity and eligibility: Reviewed and retained while required to establish identity, eligibility and compliance.
- Incident and investigation: Kept until the matter and any related claim, appeal or statutory period are closed.

9 Security
MEEEM uses reasonable access controls, authentication, encryption where appropriate, logging, backups, staff confidentiality duties and vendor safeguards. No system is completely secure. A worker must immediately report a lost device, compromised account, suspicious message or unauthorised disclosure, and must not share passwords, customer information or delivery records.

10 Worker rights and choices
Subject to applicable law and legitimate operational or legal restrictions, a worker may ask to access or correct personal information, raise a concern about its use, request deletion of information no longer required, or ask for review of a significant automated decision. A request may be made through the App support channel, the worker's supervisor or the official contact channel published at www.meeemsl.com. Identity verification may be required. MEEEM will not retaliate against a good-faith privacy concern.

11 Customer information handled by workers
Customer and merchant information shown in the App is confidential and may be used only to complete the assigned delivery. A worker must not copy, photograph, retain, publish, contact for personal reasons, or disclose that information except as authorised by MEEEM or required by law.

12 Children
The Delivery App is for authorised adult workers. MEEEM does not knowingly employ or create Delivery App accounts for persons below the lawful working or driving age.

13 Changes and contact
MEEEM may update this Policy to reflect changes in the App, operations or law. Material changes will be communicated through the App, workplace notice or another appropriate channel before or when they take effect. Questions or complaints may be submitted through the App support channel, a supervisor, or the official contact details published at www.meeemsl.com.

14 Governing standards
This Policy is governed by applicable laws of Sierra Leone, including employment, communications, cybersecurity and privacy-related requirements. If a mandatory law gives a worker greater protection than this Policy, that law prevails.`,
}

export function getRiderLegalDocument(type: "terms" | "privacy" | "all" = "all") {
  if (type === "terms") return RIDER_TERMS_AND_CONDITIONS
  if (type === "privacy") return RIDER_PRIVACY_POLICY
  return {
    terms: RIDER_TERMS_AND_CONDITIONS,
    privacy: RIDER_PRIVACY_POLICY,
  }
}

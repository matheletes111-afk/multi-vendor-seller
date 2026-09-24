import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

// Comprehensive list of burner / temp / fake email domains found in this database
const BURNER_AND_FAKE_DOMAINS = new Set([
  "94an.com", "dd2car.com", "airhemp.com", "hutdot.com", "email.com",
  "medevsa.com", "inboxorigin.com", "beiwoh.com", "aganseo.com", "bowlfuel.com",
  "careney.com", "apdtax.com", "marvetos.com", "soco7.com", "pazard.com",
  "example.com", "gmail.comtest", "bocably.com", "playboot.com", "dnsink.com",
  "ozsaip.com", "123.co", "12.com", "minitts.net", "nbins.co",
  "124.co", "raxio.app", "firstlawyer.org", "mtupu.com", "gcervera.com",
  "cadinr.com", "donumart.com", "kobace.com", "gj.com", "lealking.com",
  "nyspring.com", "nexafilm.com", "qvmao.com", "onbap.com", "pckage.com",
  "publhant.com", "maildrop.cc", "gzeos.com", "blobapps.com", "findize.com",
  "meonvr.com", "crybio.com", "fidhost.com", "novarok.org", "denipl.net",
  "fanzher.com", "prorises.com", "robustq.com", "jctoto.com", "afterdo.com",
  "bittnex.com", "luhupo.com", "ocuser.com", "acanok.com", "an.com",
  "art2mart.com", "ncleap.com", "fake.com", "test.com"
]);

// Internal developer / agency test domains
const DEV_DOMAINS = new Set(["srvtechnology.com", "meeemsl.com"]);

function classifySeller(seller: any, category: "PRODUCT_SERVICE" | "RESTAURANT" | "HOTEL") {
  const email = (seller.user?.email || "").toLowerCase().trim();
  const name = (seller.user?.name || "").trim();
  const phone = (seller.user?.phone || "").trim();
  const domain = email.includes("@") ? email.split("@")[1] : "";
  const storeOrBizName = (
    seller.store?.name ||
    seller.businessInfo?.businessName ||
    seller.businessName ||
    ""
  ).trim();

  const reasons: string[] = [];
  let isTest = false;
  let testCategory = "";

  // 1. Burner / Disposable Email Domain (even if 100% onboarded!)
  if (BURNER_AND_FAKE_DOMAINS.has(domain)) {
    isTest = true;
    testCategory = "TEMP_EMAIL_BURNER";
    reasons.push(`Disposable / temp email domain (@${domain})`);
  }

  // 2. Pre-seeded demo accounts (resto_seller1..5, foodseller@meeem.com)
  if (domain === "meeem.com" && (email.startsWith("resto_seller") || email.startsWith("foodseller"))) {
    isTest = true;
    testCategory = "SEED_DEMO_ACCOUNT";
    reasons.push(`Pre-seeded demo account (${email})`);
  }

  // 3. Developer / Agency test accounts
  const devEmails = [
    "srvdevtesting", "srvinfo", "sayanghosh", "vishaltester", "jeetbasak",
    "rishavbeas", "rishav@", "jeetservice", "somaghosh", "callmevictim41"
  ];
  if (DEV_DOMAINS.has(domain) || devEmails.some(d => email.includes(d))) {
    isTest = true;
    testCategory = "DEV_QA_ACCOUNT";
    reasons.push(`Developer / QA internal test account (${email || name})`);
  }

  // 4. Test keywords in email
  const emailLocal = email.split("@")[0] || "";
  const testKeywords = ["fake", "test", "demo", "dummy", "tester", "sample"];
  for (const kw of testKeywords) {
    if (emailLocal === kw || emailLocal.startsWith(kw) || emailLocal.endsWith(kw) || email.endsWith("test")) {
      isTest = true;
      testCategory = testCategory || "EXPLICIT_TEST_EMAIL";
      reasons.push(`Email contains test keyword (${email})`);
      break;
    }
  }

  // 5. Generic dummy emails
  const dummyGmails = [
    "new@gmail.com", "newemai@gmail.com", "ddd@gmail.com",
    "product@gmail.com", "product2@gmail.com", "product3@gmail.com",
    "service@gmail.com", "service3@gmail.com", "fake@gmail.com",
    "test12@gmail.com", "demo@gmail.com", "prakash@gmail.com",
    "turfchampionship@gmail.com"
  ];
  if (dummyGmails.includes(email)) {
    isTest = true;
    testCategory = testCategory || "DUMMY_EMAIL";
    reasons.push(`Known placeholder / test Gmail (${email})`);
  }

  // 6. XSS payloads
  if (name.includes("<script") || name.includes("alert(") || storeOrBizName.includes("<script") || storeOrBizName.includes("alert(") || phone.includes("<")) {
    isTest = true;
    testCategory = "XSS_TEST_PAYLOAD";
    reasons.push(`Contains XSS injection test strings ('${name}' / '${storeOrBizName}')`);
  }

  // 7. Obvious gibberish / spam test names
  const gibberishPatterns = [
    ":???:::::|=-0098!@#$%^*__",
    "rgergr", "tettdfc", "wrgr", "zvshhsvb", "dsss", "ffr", "fffdd", "fdd",
    "jkl", "hh", "gb", "ijkl", "fue", "ghh", "adadasd", "ts8yd8t", "gggg", "thgy", "i3neoddnd", "abc f"
  ];
  if (gibberishPatterns.includes(name.toLowerCase()) || gibberishPatterns.includes(storeOrBizName.toLowerCase())) {
    isTest = true;
    testCategory = testCategory || "GIBBERISH_TEST";
    reasons.push(`Random keyboard-mash name or store ('${name}' / '${storeOrBizName}')`);
  }

  // 8. Accounts without email and dummy phone/gibberish name or Indian dev phones
  if (!email && ["13322609570", "6693334444", "4387975853", "4387975725", "4387975724", "6289046291", "8703450042", "9164656598"].includes(phone.replace(/[^0-9]/g, ""))) {
    isTest = true;
    testCategory = "DUMMY_PHONE_SPAM";
    reasons.push(`No email, dummy/tester phone number (${phone})`);
  }

  const listingsCount = (seller._count?.products || seller._count?.foods || seller._count?.hotels || 0) + (seller._count?.services || 0);
  const ordersCount = (seller._count?.orders || seller._count?.foodOrders || 0);

  return {
    id: seller.id,
    type: category,
    sellerType: seller.type || category,
    email: email || "(No Email)",
    domain: domain || "(None)",
    name: name || "(None)",
    storeOrBizName: storeOrBizName || "(None)",
    phone: phone || "(None)",
    onboardingStep: seller.onboardingStep,
    onboardingCompleted: seller.onboardingCompleted,
    isApproved: seller.isApproved,
    createdAt: seller.createdAt,
    listingsCount,
    ordersCount,
    isTest,
    testCategory: isTest ? testCategory : "REAL",
    reasons
  };
}

async function main() {
  console.log("Re-running precise classification (READ ONLY)...");

  const [sellers, restaurantSellers, hotelSellers] = await Promise.all([
    prisma.seller.findMany({
      include: {
        user: { select: { email: true, name: true, phone: true, createdAt: true } },
        store: { select: { name: true } },
        businessInfo: { select: { businessName: true } },
        _count: { select: { products: true, services: true, orders: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.restaurantSeller.findMany({
      include: {
        user: { select: { email: true, name: true, phone: true, createdAt: true } },
        businessInfo: { select: { businessName: true } },
        _count: { select: { foods: true, foodOrders: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.hotelSeller.findMany({
      include: {
        user: { select: { email: true, name: true, phone: true, createdAt: true } },
        businessInfo: { select: { businessName: true } },
        _count: { select: { hotels: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const all = [
    ...sellers.map(s => classifySeller(s, "PRODUCT_SERVICE")),
    ...restaurantSellers.map(r => classifySeller(r, "RESTAURANT")),
    ...hotelSellers.map(h => classifySeller(h, "HOTEL"))
  ];

  const testSellers = all.filter(s => s.isTest);
  const realSellers = all.filter(s => !s.isTest);

  // Sub-breakdowns
  const tempEmailTests = testSellers.filter(s => s.testCategory === "TEMP_EMAIL_BURNER");
  const devQaTests = testSellers.filter(s => s.testCategory === "DEV_QA_ACCOUNT");
  const seedDemoTests = testSellers.filter(s => s.testCategory === "SEED_DEMO_ACCOUNT");
  const explicitTestEmails = testSellers.filter(s => s.testCategory === "EXPLICIT_TEST_EMAIL" || s.testCategory === "DUMMY_EMAIL");
  const xssGibberishTests = testSellers.filter(s => s.testCategory === "XSS_TEST_PAYLOAD" || s.testCategory === "GIBBERISH_TEST" || s.testCategory === "DUMMY_PHONE_SPAM");

  // Onboarded vs Incomplete among tests
  const onboardedTests = testSellers.filter(s => s.onboardingCompleted);
  const incompleteTests = testSellers.filter(s => !s.onboardingCompleted);

  // Real breakdown: fully onboarded vs pending onboarding
  const realOnboarded = realSellers.filter(s => s.onboardingCompleted);
  const realPendingOnboarding = realSellers.filter(s => !s.onboardingCompleted);

  const report = {
    totalSellers: all.length,
    byType: {
      productAndService: sellers.length,
      restaurant: restaurantSellers.length,
      hotel: hotelSellers.length
    },
    testSellersCount: testSellers.length,
    realSellersCount: realSellers.length,
    testBreakdown: {
      tempEmailBurnerCount: tempEmailTests.length,
      onboardedWithTempEmail: tempEmailTests.filter(t => t.onboardingCompleted).length,
      incompleteWithTempEmail: tempEmailTests.filter(t => !t.onboardingCompleted).length,
      devAndQaAccountsCount: devQaTests.length,
      seedDemoAccountsCount: seedDemoTests.length,
      explicitAndDummyEmailsCount: explicitTestEmails.length,
      xssAndGibberishSpamCount: xssGibberishTests.length,
      totalOnboardedTests: onboardedTests.length,
      totalIncompleteTests: incompleteTests.length
    },
    realBreakdown: {
      fullyOnboardedWithStore: realOnboarded.length,
      pendingOnboardingStep: realPendingOnboarding.length
    }
  };

  console.log("\n================ EXACT AUDIT RESULT ================");
  console.log(JSON.stringify(report, null, 2));

  fs.writeFileSync(
    "scratch/test-sellers-final-audit.json",
    JSON.stringify({ report, testSellers, realSellers }, null, 2),
    "utf8"
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());

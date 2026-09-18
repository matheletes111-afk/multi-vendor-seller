# Apple App Store Connect & In-App Purchase Setup Guide
## Meem Multi-Vendor Platform — iOS Seller Subscriptions

> **Domain (Production):** `https://www.meeemsl.com`  
> **App:** Meem Seller App (`com.meeem.seller`)  
> **Backend Engine:** Next.js (StoreKit 2 + App Store Server Notifications v2)  
> **Date:** September 2026  

---

## সূচিপত্র (Table of Contents)
1. [জরুরি প্রশ্নের উত্তর: প্ল্যান কি API দিয়ে তৈরি করা সম্ভব নাকি ম্যানুয়ালি করতে হবে?](#১-জরুরি-প্রশ্নের-উত্তর-প্ল্যান-কি-api-দিয়ে-তৈরি-করা-সম্ভব-নাকি-ম্যানুয়ালি-করতে-হবে)
2. [ধাপ ১: Paid Apps Agreement, ট্যাক্স ও ব্যাংকিং চুক্তি](#ধাপ-১-paid-apps-agreement-ট্যাক্স-ও-ব্যাংকিং-চুক্তি)
3. [ধাপ ২: App Store Connect-এ সাবস্ক্রিপশন গ্রুপ ও ৬টি প্রোডাক্ট তৈরি করা](#ধাপ-২-app-store-connect-এ-সাবস্ক্রিপশন-গ্রুপ-ও-৬টি-প্রোডাক্ট-তৈরি-করা)
   - [ক. Subscription Group আর্কিটেকচার (১টি নাকি ৩টি গ্রুপ?)](#ক-subscription-group-আর্কিটেকচার-১টি-নাকি-৩টি-গ্রুপ)
   - [খ. ৬টি প্রোডাক্টের নিখুঁত তালিকা ও Product ID](#খ-৬টি-প্রোডাক্টের-নিখুঁত-তালিকা-ও-product-id)
   - [গ. প্রতিটি প্রোডাক্টের প্রাইস ও লোকালাইজেশন সেটআপ](#গ-প্রতিটি-প্রোডাক্টের-প্রাইস-ও-লোকালাইজেশন-সেটআপ)
   - [ঘ. "Missing Metadata" সমাধান: Review Screenshot ও Review Notes](#ঘ-missing-metadata-সমাধান-review-screenshot-ও-review-notes-বাধ্যতামূলক)
4. [ধাপ ৩: Billing Grace Period সক্রিয় করা (আমাদের ব্যাকএন্ডের জন্য জরুরি)](#ধাপ-৩-billing-grace-period-সক্রিয়-করা-আমাদের-ব্যাকএন্ডের-জন্য-জরুরি)
5. [ধাপ ৪: ব্যাকএন্ডের জন্য In-App Purchase API Key ও .p8 ফাইল সংগ্রহ](#ধাপ-৪-ব্যাকএন্ডের-জন্য-in-app-purchase-api-key-ও-p8-ফাইল-সংগ্রহ)
6. [ধাপ ৫: App Store Server Notifications v2 (Webhook) সেটআপ](#ধাপ-৫-app-store-server-notifications-v2-webhook-সেটআপ)
7. [ধাপ ৬: প্রথমবার অ্যাপ সাবমিশনে সাবস্ক্রিপশন যুক্ত করা (Attach IAP to App Version)](#ধাপ-৬-প্রথমবার-অ্যাপ-সাবমিশনে-সাবস্ক্রিপশন-যুক্ত-করা-attach-iap-to-app-version)
8. [ধাপ ৭: Apple Guideline 3.1.2 কমপ্লায়েন্স (EULA, Privacy Policy ও Restore Button)](#ধাপ-৭-apple-guideline-312-কমপ্লায়েন্স-eula-privacy-policy-ও-restore-button)
9. [ধাপ ৮: Sandbox Tester একাউন্ট তৈরি ও ফিজিক্যাল আইফোনে টেস্টিং](#ধাপ-৮-sandbox-tester-একাউন্ট-তৈরি-ও-ফিজিক্যাল-আইফোনে-টেস্টিং)
10. [ধাপ ৯: ব্যাকএন্ড .env সেটআপ ও ডাটাবেস অটো-লিংক স্ক্রিপ্ট রান](#ধাপ-৯-ব্যাকএন্ড-env-সেটআপ-ও-ডাটাবেস-অটো-লিংক-স্ক্রিপ্ট-রান)
11. [সর্বশেষ কমপ্লিট চেকলিস্ট ও ট্রাবলশুটিং](#সর্বশেষ-কমপ্লিট-চেকলিস্ট-ও-ট্রাবলশুটিং)

---

## ১. জরুরি প্রশ্নের উত্তর: প্ল্যান কি API দিয়ে তৈরি করা সম্ভব নাকি ম্যানুয়ালি করতে হবে?

### ক. App Store Connect-এ (অ্যাপল ওয়েবসাইটে):
* **API দিয়ে কি সম্ভব?**  
  হ্যাঁ, অ্যাপলের **App Store Connect REST API** (`/v1/subscriptions`, `/v1/subscriptionGroups`) রয়েছে যার মাধ্যমে প্রোগ্রাম্যাটিক্যালি প্রোডাক্ট তৈরি করা যায়।
* **কিন্তু কেন UI (ম্যানুয়ালি) দিয়ে করাই স্ট্যান্ডার্ড ও রিকমেন্ডেড?**  
  1. আমাদের প্ল্যাটফর্মে মোট প্রোডাক্ট মাত্র **৬টি**। ওয়েবসাইটে গিয়ে ফর্ম ফিলাপ করে ৬টি প্রোডাক্ট বানাতে সর্বোচ্চ **৫ থেকে ৭ মিনিট** লাগে।
  2. API দিয়ে তৈরি করতে গেলে আগেই API Key (.p8), JWT টোকেন জেনারেটর এবং জটিল JSON পে-লোড কোড করতে হয়।
  3. সবচেয়ে বড় কারণ হলো—অ্যাপল রিভিউয়ের জন্য প্রতিটি প্রোডাক্টের সাথে একটি **"Review Screenshot"** (সাবস্ক্রিপশন পেজের স্ক্রিনশট) এবং **"Review Notes"** ম্যানুয়ালি আপলোড করতে হয়। এটি API দিয়ে দেওয়া অত্যন্ত জটিল ও সময়সাপেক্ষ।
  4. তাই বিশ্বজুড়ে সমস্ত iOS টিম App Store Connect ওয়েবসাইটের UI থেকেই এককালীন এই প্রোডাক্টগুলো তৈরি করে থাকে।

### খ. আমাদের ব্যাকএন্ড ডাটাবেসে:
* ডাটাবেসে আপনার আর কোনো ম্যানুয়াল কাজ নেই!
* আমরা ইতোমধ্যে একটি অটোমেটিক স্ক্রিপ্ট তৈরি করে দিয়েছি। টার্মিনালে শুধু রান করবেন:
  ```bash
  pnpm db:link-apple-plans
  ```
  এটি ১ সেকেন্ডের মধ্যে ডাটাবেসের সব প্ল্যানের সাথে অ্যাপল প্রোডাক্ট আইডি লিংক করে দেবে।

---

## ধাপ ১: Paid Apps Agreement, ট্যাক্স ও ব্যাংকিং চুক্তি

অ্যাপল স্টোরে কোনো পেইড সাবস্ক্রিপশন বিক্রি করার পূর্বে ডেভেলপার একাউন্টে পেইড এগ্রিমেন্ট সাইন করা বাধ্যতামূলক। এটি না করলে অ্যাপলের StoreKit থেকে প্রোডাক্ট লিস্ট রিটার্ন করে না (ফাঁকা `[]` আসে) এবং App Store Connect-এ সাবস্ক্রিপশন তৈরিতে বাধা আসতে পারে।

1. আপনার ব্রাউজার থেকে [App Store Connect](https://appstoreconnect.apple.com)-এ **Account Holder** রোলের আইডি দিয়ে লগইন করুন।
2. হোম স্ক্রিন থেকে **Agreements, Tax, and Banking** (চুক্তি, ট্যাক্স ও ব্যাংকিং) ট্যাবে যান।
3. **Agreements** সেকশনে:
   * **Paid Applications Agreement** খুঁজে বের করুন এবং **Review & Accept** করুন।
4. **Banking** সেকশনে:
   * **Add Bank Account**-এ ক্লিক করে আপনার প্রতিষ্ঠানের ব্যাংক একাউন্টের সুইফট কোড (SWIFT) ও IBAN/একাউন্ট নম্বর যোগ করুন (যেখানে অ্যাপল সাবস্ক্রিপশনের আয় পাঠাবে)।
5. **Tax Information** সেকশনে:
   * মার্কিন যুক্তরাষ্ট্রের ট্যাক্স ফর্ম ফিলাপ করুন (যুক্তরাষ্ট্রের বাইরের কোম্পানির জন্য সাধারণত **Form W-8BEN-E** অথবা ব্যক্তি মালিকানার জন্য **Form W-8BEN**)।
6. নিশ্চিত করুন এগ্রিমেন্টের স্ট্যাটাস সবুজ রঙে **Active** দেখাচ্ছে।

---

## ধাপ ২: App Store Connect-এ সাবস্ক্রিপশন গ্রুপ ও ৬টি প্রোডাক্ট তৈরি করা

### ক. Subscription Group আর্কিটেকচার (১টি নাকি ৩টি গ্রুপ?)

অ্যাপল সাবস্ক্রিপশনে **Subscription Group** অত্যন্ত গুরুত্বপূর্ণ। একই গ্রুপের ভেতরের প্ল্যানগুলোতে ইউজার আইওএস সেটিংস থেকে আপগ্রেড/ডাউনগ্রেড করতে পারে। 

আমাদের প্ল্যাটফর্মে ৪ ধরণের সেলার আছে (Product, Service, Hotel, Restaurant)। এখানে সর্বোত্তম দুটি পদ্ধতি আছে:

* **পদ্ধতি ১ (রিকমেন্ডেড - ৩টি আলাদা গ্রুপ):**
  1. `General Seller Subscriptions` (Product ও Service সেলারদের জন্য: Standard, Premium)
  2. `Hotel Seller Subscriptions` (Hotel সেলারদের জন্য: Standard, Premium)
  3. `Restaurant Seller Subscriptions` (Restaurant সেলারদের জন্য: Standard, Premium)
  > *সুবিধা:* একজন হোটেল সেলার কখনোই ভুলবশত আইওএস সেটিংস মেনু থেকে রেস্টুরেন্ট বা সাধারণ সেলার প্ল্যানে ক্রস-গ্রেড করতে পারবে না।

* **পদ্ধতি ২ (সহজ পদ্ধতি - ১টি একক গ্রুপ):**
  * একটি একক গ্রুপ তৈরি করুন: `Seller Subscriptions`
  * এর ভেতরে ৬টি প্রোডাক্টই যোগ করবেন।
  * গ্রুপ লেভেল র্যাংকিং (Ranking):
    - Level 1 (উপরে): সব `PREMIUM` প্ল্যানগুলো।
    - Level 2 (নিচে): সব `STANDARD` প্ল্যানগুলো।

> 💡 **নোট:** আপনি যেকোনো একটি পদ্ধতি বেছে নিতে পারেন। নিচে ধাপগুলো বিস্তারিত দেওয়া হলো:

1. App Store Connect মেনু থেকে **Apps** > আপনার সেলার অ্যাপটি সিলেক্ট করুন (`meem_seller` বা `com.meeem.seller`)।
2. বাম পাশের মেনু থেকে **Monetization** সেকশনে গিয়ে **Subscriptions**-এ ক্লিক করুন।
3. **Subscription Groups** সেকশনে **(+)** বাটনে ক্লিক করুন:
   * **Group Reference Name:** দিন `Seller Subscriptions` (বা ৩টি গ্রুপের নাম)।
   * Create-এ ক্লিক করুন।
4. গ্রুপের ভেতরে ঢুকে **Subscription Group Display Name** (লোকালাইজেশন) দিন:
   * যেমন English (U.S.) সিলেক্ট করে লিখুন: `Meem Seller Memberships`।

---

### খ. প্রোডাক্টের নিখুঁত তালিকা ও Product ID (৬টি মাসিক + ১টি ঐচ্ছিক ত্রৈমাসিক)

> 💡 **নোট:** আমাদের সিস্টেমে ৩টি Free প্ল্যানও রয়েছে (Product, Hotel, Restaurant)। কিন্তু **Free প্ল্যান অ্যাপল স্টোরে তৈরি করতে হয় না**, কারণ অ্যাপল ইন-অ্যাপ পারচেজ কেবল পেইড লেনদেনের জন্য।

গ্রুপের ভেতরে ঢুকে **Subscriptions (+)** বাটনে ক্লিক করে নিচের **মূল ৬টি মাসিক প্রোডাক্ট** (এবং প্রয়োজন হলে ৭ম ত্রৈমাসিক প্রোডাক্টটি) তৈরি করুন:

| ক্র. | সেলার টাইপ | Reference Name (অভ্যন্তরীণ নাম) | Product ID (হুবহু এটি লিখবেন) | Duration |
| :---: | :--- | :--- | :--- | :---: |
| **১** | Product / Service | Basic Plan (Le 200) | `com.meeem.seller.basic` | 1 Month |
| **২** | Product / Service | Standard Plan (Le 300) | `com.meeem.seller.standard` | 1 Month |
| **৩** | Product / Service | Premium Plan (Le 1,500) | `com.meeem.seller.premium` | 3 Months |
| **৪** | Hotel | Hotel Standard (Le 200) | `com.meeem.seller.hotel.standard` | 1 Month |
| **৫** | Hotel | Hotel Premium (Le 500) | `com.meeem.seller.hotel.premium` | 1 Month |
| **৬** | Restaurant | Restaurant Standard (Le 200) | `com.meeem.seller.restaurant.standard` | 1 Month |
| **৭** | Restaurant | Restaurant Premium (Le 500) | `com.meeem.seller.restaurant.premium` | 1 Month |

> ⚠️ **সতর্কতা:** `Product ID` একবার তৈরি করলে আর পরিবর্তন বা এডিট করা যায় না। বানানে যেন কোনো ভুল না হয়। হুবহু ওপরের আইডিগুলোই ব্যবহার করুন।

---

### গ. প্রতিটি প্রোডাক্টের প্রাইস ও লোকালাইজেশন সেটআপ

প্রতিটি প্রোডাক্ট তৈরির পর তার ভেতরে ঢুকে নিচের ফিল্ডগুলো কনফিগার করুন:

1. **Subscription Duration:** ড্রপডাউন থেকে সিলেক্ট করুন **1 Month**।
2. **Subscription Pricing:**
   * **Add Pricing** (অথবা Create Subscription Price)-এ ক্লিক করুন।
   * আপনার মূল কারেন্সি ও বেস প্রাইস নির্বাচন করুন (যেমন Sierra Leone Leone (SLL/SLE) বা Le 200, Le 300, Le 500 অথবা আপনার নির্ধারিত মূল্য)।
   * অ্যাপল স্বয়ংক্রিয়ভাবে বিশ্বের বাকি ১৭৫+ দেশের কারেন্সিতে সমমূল্য রূপান্তর করে নেবে। Next করে Confirm করুন।
3. **App Store Localization:**
   * **(+)** বাটনে ক্লিক করে ভাষা সিলেক্ট করুন: `English (U.S.)`
   * **Subscription Display Name:** গ্রাহক পে-ওয়ালে যে নাম দেখবে (যেমন: `Standard Seller Plan` বা `Premium Seller Plan`)।
   * **Description:** এই প্ল্যানে কী সুবিধা পাবে তার সংক্ষিপ্ত বিবরণ (যেমন: `Unlock product uploads, order management, and seller analytics`).

---

### ঘ. "Missing Metadata" সমাধান: Review Screenshot ও Review Notes (বাধ্যতামূলক!)

প্রোডাক্ট তৈরি করার পর আপনি দেখতে পাবেন সেটির স্ট্যাটাস দেখাচ্ছে হলুদ রঙে **"Missing Metadata"**। এই স্ক্রিনশট ও নোট না দেওয়া পর্যন্ত অ্যাপল আপনার সাবস্ক্রিপশন প্রোডাক্টটি রিভিউয়ের জন্য জমা নিতে দেবে না!

প্রতিটি প্রোডাক্ট পেজের নিচের দিকে স্ক্রোল করলে দেখতে পাবেন **App Store Review Information**:

1. **Review Screenshot:**
   * **কী দিতে হবে?** আপনার মোবাইল অ্যাপের যে স্ক্রিনে সেলাররা সাবস্ক্রিপশন কিনতে পারে (Paywall / Subscription screen)—সেই স্ক্রিনের একটি স্ক্রিনশট দিতে হবে।
   * **রিকোয়ারমেন্ট:** আইফোন বা আইপ্যাডের রিয়েল রেজোলিউশন স্ক্রিনশট (যেমন iPhone 15/16 Pro Max-এর জন্য 1290 x 2796 px অথবা যেকোনো রিটিনা আইফোন রেজোলিউশন, ফরম্যাট: PNG বা JPEG)।
   * *টিপ:* মোবাইল অ্যাপের পে-ওয়াল স্ক্রিনের একটি সিমুলেটর/মকআপ স্ক্রিনশট আপলোড করে দিন যেখানে প্ল্যানের নাম ও মূল্য দেখা যাচ্ছে।
2. **Review Notes:**
   * অ্যাপল রিভিউয়ার যাতে সহজে অ্যাপে ঢুকে প্ল্যানটি টেস্ট করতে পারে, তার জন্য নির্দেশনা দিন:
   ```text
   Demo Seller Credentials:
   Username: test_seller@meeem.com
   Password: TestPassword123!
   
   Steps to test:
   1. Log in with the credentials above.
   2. Navigate to Profile / Settings > Upgrade Plan.
   3. The subscription paywall will appear showing this plan.
   ```
3. পেজের ওপরে ডানপাশে **Save** বাটনে ক্লিক করুন। সেভ হওয়ার পর স্ট্যাটাস **"Ready to Submit"** হয়ে যাবে।

---

## ধাপ ৩: Billing Grace Period সক্রিয় করা (আমাদের ব্যাকএন্ডের জন্য জরুরি)

আমাদের ব্যাকএন্ড সার্ভারে `IN_GRACE_PERIOD` স্ট্যাটাস এবং ASSN v2 `DID_FAIL_TO_RENEW` হ্যান্ডলার তৈরি করা রয়েছে। কোনো সেলারের ক্রেডিট কার্ডের মেয়াদ শেষ হয়ে গেলে বা ব্যালেন্স না থাকলে অ্যাপল তাদের ১৬ দিন সময় দেয় কার্ড আপডেট করার জন্য। 

এই সুবিধা চালু করতে অ্যাপল স্টোর কানেক্টে এটি সক্রিয় করতে হবে:

1. App Store Connect > **Apps** > `meem_seller`-এ যান।
2. বাম পাশের সাইডবারে **Monetization** > **Subscriptions**-এ ক্লিক করুন।
3. পেজের নিচে স্ক্রোল করে **Billing Grace Period** সেকশনে যান।
4. **Turn On Billing Grace Period** (অথবা Edit)-এ ক্লিক করুন।
5. চেকবক্সে টিক দিন:
   * **Turn on Billing Grace Period for all subscriptions** (অথবা আপনার সাবস্ক্রিপশন গ্রুপ সিলেক্ট করুন)।
6. **Save** করুন।
> 💡 এর ফলে কোনো সেলারের মাসিক অটো-রিনিউয়াল ফেইল করলে অ্যাপল সাথে সাথে তার দোকান বন্ধ করবে না, বরং ১৬ দিন গ্রেস পিরিয়ড দেবে। আমাদের ব্যাকএন্ড স্বয়ংক্রিয়ভাবে তার স্ট্যাটাস `IN_GRACE_PERIOD` করে দেবে।

---

## ধাপ ৪: ব্যাকএন্ডের জন্য In-App Purchase API Key ও .p8 ফাইল সংগ্রহ

ব্যাকএন্ড থেকে অ্যাপল সার্ভারের সাথে যোগাযোগ এবং ক্রিপ্টোগ্রাফিক ট্রানজেকশন ভেরিফাই করার জন্য API Credentials প্রয়োজন:

1. App Store Connect-এর ওপরের নেভিগেশন মেনু থেকে **Users and Access**-এ ক্লিক করুন।
2. পেজের ওপরে **Integrations** ট্যাবে যান।
3. বাম পাশের সাইডবারে Key Type হিসেবে **In-App Purchase** সিলেক্ট করুন।
4. **Generate In-App Purchase Key** (অথবা নীল **+** বাটনে) ক্লিক করুন:
   * **Name:** দিন `Meem Backend IAP Key`
   * **Generate** বাটনে ক্লিক করুন।
5. পেজটিতে ৩টি অতি গুরুত্বপূর্ণ ক্রেডেনশিয়াল দেখতে পাবেন, এগুলো কপি করে সংরক্ষণ করুন:
   * **Issuer ID:** পেজের একদম ওপরে থাকা UUID (যেমন: `57246542-96fe-1a63-e053-0824d011072a`)
   * **Key ID:** আপনার তৈরি করা কি-এর নামের পাশে থাকা ১০ ক্যারেক্টারের কোড (যেমন: `2X9R4HXF34`)
   * **Private Key (.p8 ফাইল):** **Download API Key** বাটনে ক্লিক করে ফাইলটি ডাউনলোড করুন (নাম হবে যেমন: `AuthKey_2X9R4HXF34.p8`)।
   
> ⚠️ **সতর্কতা:** অ্যাপল সিকিউরিটির নিয়মে `.p8` ফাইলটি জীবনে **একবারই ডাউনলোড** করতে দেয়। দ্বিতীয়বার আর ডাউনলোডের লিংক পাওয়া যাবে না। তাই ফাইলটি গুগল ড্রাইভ বা সুরক্ষিত ড্রাইভে ব্যাকআপ রাখুন।

---

## ধাপ ৫: App Store Server Notifications v2 (Webhook) সেটআপ

যখন কোনো সেলারের সাবস্ক্রিপশন অটো-রিনিউ হবে, বিলিং ফেইল করবে, গ্রেস পিরিয়ডে যাবে অথবা বাতিল হবে—তখন অ্যাপল স্বয়ংক্রিয়ভাবে আমাদের ব্যাকএন্ড Webhook-এ ইভেন্ট পাঠাবে।

1. App Store Connect থেকে আবার **Apps** > আপনার সেলার অ্যাপে যান।
2. বাম পাশের মেনু থেকে **App Information**-এ ক্লিক করুন।
3. স্ক্রোল করে নিচে **App Store Server Notifications** সেকশনে যান।
4. **Set Up URL** (অথবা **Edit**)-এ ক্লিক করুন:
   * **Version:** অবশ্যই ড্রপডাউন থেকে **Version 2 Notifications** সিলেক্ট করবেন।
   * **Production URL:** `https://www.meeemsl.com/api/webhooks/apple-iap`
   * **Sandbox URL:** `https://www.meeemsl.com/api/webhooks/apple-iap` *(অথবা আপনার স্টেজিং ডোমেইন থাকলে সেটি দিতে পারেন)*
5. **Save** বাটনে ক্লিক করুন।

---

## ধাপ ৬: প্রথমবার অ্যাপ সাবমিশনে সাবস্ক্রিপশন যুক্ত করা (Attach IAP to App Version)

> 🚨 **সবচেয়ে কমন ভুল:** অনেকেই ৬টি প্রোডাক্ট তৈরি করেন, কিন্তু যখন আইওএস অ্যাপের নতুন ভার্সন অ্যাপলের কাছে সাবমিট করেন, তখন সাবস্ক্রিপশনগুলো এটাচ করতে ভুলে যান! এর ফলে অ্যাপ রিজেক্ট হয়ে যায়।

যখন আপনার মোবাইল ডেভেলপার অ্যাপের বিল্ড (Build) আপলোড করবে এবং আপনি অ্যাপটি রিভিউয়ের জন্য জমা দেবেন:

1. App Store Connect > **Apps** > আপনার অ্যাপের বর্তমান ভার্সনে যান (যেমন `1.0.0 Prepare for Submission`)।
2. পেজটি স্ক্রোল করে নিচে নামলে **In-App Purchases and Subscriptions** নামে একটি সেকশন দেখতে পাবেন।
3. সেখানে **Select In-App Purchases** (অথবা **+** বাটনে) ক্লিক করুন।
4. আপনার তৈরি করা ৬টি সাবস্ক্রিপশন প্রোডাক্টের চেকবক্সে টিক দিন এবং **Done** ক্লিক করুন।
5. একই পেজের **App Review Information** সেকশনে:
   * **Sign-in required** বক্সে টিক দিন।
   * ডেমো সেলার ইউজারনেম ও পাসওয়ার্ড দিন।
   * **Notes** বক্সে লিখে দিন: `"Please use the demo account to log in and visit the Subscription screen to test the In-App Purchase functionality."`
6. এরপরই কেবল পেজের ওপরে থাকা **Submit for Review** বাটন কাজ করবে।

---

## ধাপ ৭: Apple Guideline 3.1.2 কমপ্লায়েন্স (EULA, Privacy Policy ও Restore Button)

অ্যাপল অটো-রিনিউয়েবল সাবস্ক্রিপশন অ্যাপের জন্য ৩টি বিষয় বাধ্যতামূলক করেছে (Guideline 3.1.2):

1. **Terms of Use (EULA):**
   * App Store Connect-এর অ্যাপ ইনফরমেশনে অথবা আপনার ওয়েবসাইটে ব্যবহারের শর্তাবলী থাকতে হবে।
   * URL: `https://www.meeemsl.com/terms` (অথবা অ্যাপলের স্ট্যান্ডার্ড EULA: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`)।
2. **Privacy Policy URL:**
   * App Information পেজে Privacy Policy URL ফিল্ডে লিংক দিন: `https://www.meeemsl.com/privacy-policy` (অথবা `https://www.meeemsl.com/privacy` — দুটি লিঙ্কই এখন লাইভ কাজ করে)।
3. **Restore Purchases বাটন (মোবাইল অ্যাপে):**
   * মোবাইল অ্যাপের সাবস্ক্রিপশন পে-ওয়ালে অবশ্যই একটি **"Restore Purchases"** বাটন থাকতে হবে। 
   * আমরা ইতোমধ্যে এর জন্য ব্যাকএন্ড API তৈরি করে রেখেছি: `POST /mobileapi/seller/iap/restore`।

---

## ধাপ ৮: Sandbox Tester একাউন্ট তৈরি ও ফিজিক্যাল আইফোনে টেস্টিং

ডেভেলপমেন্ট বা টেস্টিংয়ের সময় আসল ক্রেডিট কার্ড ছাড়া সম্পূর্ণ বিনামূল্যে সাবস্ক্রিপশন ক্রয় ও রিনিউয়াল টেস্ট করার জন্য অ্যাপল Sandbox অ্যাকাউন্ট দেয়:

1. App Store Connect-এ **Users and Access**-এ যান।
2. বাম পাশের সাইডবারে **Sandbox** সেকশনের অধীনে **Testers**-এ ক্লিক করুন।
3. **+** বাটনে ক্লিক করে একটি টেস্ট অ্যাকাউন্ট তৈরি করুন:
   * First Name ও Last Name দিন।
   * **Email:** এমন একটি ইমেইল দিন যা কোনো আসল অ্যাপল আইডিতে ব্যবহৃত নয় (যেমন: `tester.meem1@gmail.com`)।
   * **Password:** একটি শক্তিশালী পাসওয়ার্ড দিন।
   * **Country/Region:** আপনার টেস্টিং দেশ সিলেক্ট করুন।
4. **বাস্তব আইফোনে যেভাবে টেস্ট করবেন:**
   * টেস্ট আইফোনের **Settings** অ্যাপ খুলুন।
   * স্ক্রোল করে **App Store**-এ ঢুকুন।
   * পেজের একদম নিচে নামলে দেখতে পাবেন **SANDBOX ACCOUNT** অপশন।
   * সেখানে আপনার তৈরি করা Sandbox Tester ইমেইল ও পাসওয়ার্ড দিয়ে সাইন-ইন করুন (আপনার মেইন অ্যাপল আইডি লগআউট করার প্রয়োজন নেই)।
   * এবার Flutter সেলার অ্যাপ রান করে সাবস্ক্রিপশন ক্রয় করলে কোনো টাকা ছাড়াই পেমেন্ট সফল হবে।
   * *(নোট: Sandbox মোডে টেস্ট করার সুবিধার জন্য অ্যাপল ১ মাসের সাবস্ক্রিপশনকে প্রতি ৫ মিনিটে রিনিউ করায়!)*

---

## ধাপ ৯: ব্যাকএন্ড .env সেটআপ ও ডাটাবেস অটো-লিংক স্ক্রিপ্ট রান

### ১. সার্ভারের `.env` ফাইলে ভ্যারিয়েবল যোগ করুন:

```env
# ==========================================
# APPLE IN-APP PURCHASE CONFIGURATION
# ==========================================
APPLE_IAP_ISSUER_ID="আপনার Issuer ID (UUID)"
APPLE_IAP_KEY_ID="আপনার Key ID (১০ ক্যারেক্টার)"

# ডাউনলোড করা .p8 ফাইলটি Notepad দিয়ে খুলে পুরো কন্টেন্ট হুবহু কপি করে এখানে পেস্ট করুন:
APPLE_IAP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHknlhdf...\n-----END PRIVATE KEY-----"

APPLE_BUNDLE_ID="com.meeem.seller"
APPLE_ENVIRONMENT="Sandbox" # প্রোডাকশনে লাইভ করার সময় "Production" করবেন
```

### ২. ডাটাবেসের সমস্ত প্ল্যানে অ্যাপল প্রোডাক্ট আইডি লিংক করার কমান্ড:
টার্মিনালে সরাসরি রান করুন:

```bash
pnpm db:link-apple-plans
```
*(অথবা `npm run db:link-apple-plans`)*

এই কমান্ডটি ডাটাবেসের Product, Hotel এবং Restaurant-এর সবকটি প্ল্যানে অ্যাপল প্রোডাক্ট আইডি স্বয়ংক্রিয়ভাবে আপডেট করে দেবে।

---

## সর্বশেষ কমপ্লিট চেকলিস্ট ও ট্রাবলশুটিং

| ধাপ | করণীয় কাজ | স্ট্যাটাস |
| :---: | :--- | :---: |
| **১** | Paid Applications Agreement অ্যাক্টিভ করা (Agreements, Tax & Banking) | [ ] |
| **২** | Subscription Group তৈরি ও লোকালাইজেশন নাম দেওয়া | [ ] |
| **৩** | ৬টি সাবস্ক্রিপশন প্রোডাক্ট তৈরি করা (`com.meeem.seller.*`) | [ ] |
| **৪** | প্রতিটি প্রোডাক্টে প্রাইস ($), ডিউরেশন (1 Month) ও লোকালাইজেশন সেট করা | [ ] |
| **৫** | প্রতিটি প্রোডাক্টে Review Screenshot ও Review Notes আপলোড করে "Ready to Submit" করা | [ ] |
| **৬** | **Billing Grace Period** Turn On করা (16 days grace period) | [ ] |
| **৭** | In-App Purchase Key জেনারেট করে `.p8`, Key ID, Issuer ID সেভ করা | [ ] |
| **৮** | Server Notifications v2 তে Webhook URL (`https://www.meeemsl.com/api/webhooks/apple-iap`) বসানো | [ ] |
| **৯** | App Version সাবমিশন পেজে ৬টি সাবস্ক্রিপশন প্রোডাক্ট Attach করা | [ ] |
| **১০** | Terms of Use (`/terms`) ও Privacy Policy (`/privacy`) URL সেট করা | [ ] |
| **১১** | Sandbox Tester একাউন্ট বানিয়ে ফিজিক্যাল আইফোনে টেস্ট করা | [ ] |
| **১২** | সার্ভার `.env` আপডেট ও `pnpm db:link-apple-plans` রান করা | [ ] |

### দ্রুত ট্রাবলশুটিং গাইড:
* **প্রশ্ন: আইওএস অ্যাপে প্রোডাক্ট লিস্ট কল করলে ফাঁকা `[]` আসছে কেন?**  
  *সমাধান:* ১) Paid Apps Agreement অ্যাক্টিভ আছে কিনা দেখুন। ২) প্রোডাক্টগুলো "Ready to Submit" স্ট্যাটাসে আছে কিনা দেখুন। ৩) টেস্ট আইফোনে Sandbox অ্যাকাউন্টে লগইন আছে কিনা নিশ্চিত করুন।
* **প্রশ্ন: সাবস্ক্রিপশন প্রোডাক্ট সেভ হচ্ছে না বা সাবমিট বাটনে এরর দিচ্ছে?**  
  *সমাধান:* "Missing Metadata" দেখতে পাবেন—প্রতিটি প্রোডাক্টে অবশ্যই একটি Review Screenshot আপলোড করতে হবে।
* **প্রশ্ন: ব্যাকএন্ডে Webhook এরর ৪০১ দিচ্ছে কেন?**  
  *সমাধান:* `.env` ফাইলে `APPLE_BUNDLE_ID` ঠিক আছে কিনা এবং `.p8` প্রাইভেট কি সম্পূর্ণ কপি হয়েছে কিনা যাচাই করুন।

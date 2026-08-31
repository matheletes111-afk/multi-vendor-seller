# AWS Amplify Cron Setup Guide: Seller Onboarding & Document Reminder

This guide explains how to set up automated scheduled cron jobs to trigger the **Seller Onboarding & Pending Document Reminder** endpoint on **AWS Amplify Hosting**.

---

## 1. Overview & Endpoint Details

The endpoint scans all seller types (**Product**, **Service**, **Hotel**, and **Restaurant**) for incomplete profiles or pending documents, and sends them a tailored reminder email with a **2 Months Free Access** promotional offer.

### Endpoint URL
```http
POST https://<your-amplify-domain>/api/cron/seller-onboarding-reminder
GET  https://<your-amplify-domain>/api/cron/seller-onboarding-reminder
```

### Authentication
Include either `INTERNAL_API_SECRET` or `CRON_SECRET` in any of the following ways:
- **HTTP Header**: `x-internal-secret: <YOUR_SECRET>`
- **HTTP Header**: `Authorization: Bearer <YOUR_SECRET>`
- **Query Parameter**: `?secret=<YOUR_SECRET>`

### Query / Body Parameters
| Parameter | Type | Default | Description |
|---|---|---|---|
| `dryRun` | `boolean` | `false` | When `true`, lists eligible sellers and missing documents without sending emails. |
| `sellerType` | `string` | `ALL` | Filter: `ALL`, `PRODUCT`, `SERVICE`, `HOTEL`, `RESTAURANT`. |
| `limit` | `number` | `100` | Batch size limit (1 to 500) to prevent timeouts. |
| `freeMonths` | `number` | `2` | Number of free promotional months displayed in the email. |

---

## 2. Environment Variables in AWS Amplify

Ensure the following variables are configured in the **AWS Amplify Console** under **App Settings > Environment variables**:

1. `INTERNAL_API_SECRET` (or `CRON_SECRET`): A strong secret token (e.g. `meeem_cron_sec_...`).
2. `SENDGRID_API_KEY`: Your SendGrid API Key.
3. `SENDGRID_FROM_EMAIL`: Verified sender email (e.g. `noreply@meeemsl.com`).
4. `NEXT_PUBLIC_LIVE_SITE_URL` / `NEXTAUTH_URL`: Your live domain (e.g. `https://meeemsl.com`).

---

## 3. How to Schedule on AWS

### Method A: AWS EventBridge API Destination (Recommended Native AWS)

1. Go to **AWS EventBridge Console** > **API Destinations** > **Create API Destination**.
   - **Name**: `MeeemSellerOnboardingReminderDestination`
   - **Endpoint URL**: `https://<your-amplify-domain>/api/cron/seller-onboarding-reminder`
   - **HTTP Method**: `POST`
   - **Connection**: Click *Create a new connection*:
     - **Connection Type**: `API Key` (or `Other`)
     - **API Key Name**: `x-internal-secret`
     - **Value**: Your secret token (`INTERNAL_API_SECRET`).
2. Go to **EventBridge > Rules** > **Create Rule**.
   - **Name**: `DailySellerOnboardingReminderRule`
   - **Rule Type**: `Schedule`
   - **Schedule Pattern**: `cron(0 9 * * ? *)` (Runs daily at 09:00 UTC / AM).
   - **Target**: Select `EventBridge API destination` and choose `MeeemSellerOnboardingReminderDestination`.
   - **Input**: Constant JSON:
     ```json
     {
       "dryRun": false,
       "sellerType": "ALL",
       "limit": 100
     }
     ```

---

### Method B: AWS EventBridge + Simple Lambda Function

If you prefer using an AWS Lambda function triggered by EventBridge:

```javascript
// index.mjs (AWS Lambda Node.js 18+)
export const handler = async (event) => {
  const endpoint = process.env.API_ENDPOINT || "https://your-domain.com/api/cron/seller-onboarding-reminder";
  const secret = process.env.INTERNAL_API_SECRET;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({
      dryRun: false,
      sellerType: "ALL",
      limit: 100,
    }),
  });

  const data = await response.json();
  console.log("Cron execution result:", JSON.stringify(data));
  return data;
};
```

---

### Method C: GitHub Actions Scheduled Cron (Alternative)

You can also run the cron directly via a GitHub Action `.github/workflows/onboarding-reminder-cron.yml`:

```yaml
name: Seller Onboarding Reminder Cron

on:
  schedule:
    # Runs at 09:00 UTC every Tuesday and Friday
    - cron: '0 9 * * 2,5'
  workflow_dispatch: # Allows manual trigger from GitHub UI

jobs:
  trigger-reminder:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Seller Reminder Endpoint
        run: |
          curl -X POST "https://your-domain.com/api/cron/seller-onboarding-reminder" \
            -H "Content-Type: application/json" \
            -H "x-internal-secret: ${{ secrets.INTERNAL_API_SECRET }}" \
            -d '{"dryRun": false, "sellerType": "ALL", "limit": 100}'
```

---

## 4. Manual Testing & CLI Execution

### Test Dry Run with cURL
```bash
curl -X GET "https://<your-amplify-domain>/api/cron/seller-onboarding-reminder?dryRun=true&secret=<YOUR_SECRET>"
```

### Trigger Live Run with cURL
```bash
curl -X POST "https://<your-amplify-domain>/api/cron/seller-onboarding-reminder" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: <YOUR_SECRET>" \
  -d '{"dryRun": false, "sellerType": "ALL", "limit": 50}'
```

### Run Locally via CLI
```bash
# Preview mode (dry-run)
npm run cron:onboarding-reminders -- --dry-run

# Live execution
npm run cron:onboarding-reminders
```

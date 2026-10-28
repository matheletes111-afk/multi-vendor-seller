import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import {
  getAfriMoneyConfig,
  maskKey,
  checkBridgeHealth,
  testBridgeTunnel,
  testOAuthToken,
  initiateAfriMoneyPushUssd,
  queryAfriMoneyTransaction,
} from "@/lib/afrimoney"

export const dynamic = "force-dynamic"

/**
 * Diagnostic & Connectivity Test API for AfriMoney Payment Gateway & Bridge
 *
 * Usage:
 * - Direct Browser / Postman: GET /api/afrimoney/test?secret=meeem_afrimoney_test
 * - Trigger Push USSD Test: GET /api/afrimoney/test?secret=meeem_afrimoney_test&action=push_test&msisdn=033600171
 * - Or logged in as Admin session
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secretParam = searchParams.get("secret")
  const action = searchParams.get("action")
  const testMsisdn = searchParams.get("msisdn") || "033600171"
  const refParam = searchParams.get("ref")

  // Authentication check
  const session = await auth().catch(() => null)
  const isAuthorizedAdmin = session?.user ? isAdmin(session.user) : false

  const config = getAfriMoneyConfig()

  const allowedSecrets = [
    "meeem_afrimoney_test",
    process.env.INTERNAL_API_SECRET,
    process.env.CRON_SECRET,
    process.env.AFRIMONEY_BRIDGE_KEY,
  ].filter(Boolean) as string[]

  const isAuthorizedBySecret = Boolean(
    secretParam && allowedSecrets.includes(secretParam)
  )

  if (!isAuthorizedAdmin && !isAuthorizedBySecret) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Provide ?secret=meeem_afrimoney_test in the URL or log in as Admin to run AfriMoney diagnostics.",
      },
      { status: 401 }
    )
  }

  // 1. Environment Variables Audit
  const envAudit = {
    bridgeUrl: config.bridgeUrl,
    hasBridgeKey: Boolean(config.bridgeKey),
    bridgeKeyPreview: maskKey(config.bridgeKey),
    hasConsumerKey: Boolean(config.consumerKey),
    consumerKeyPreview: maskKey(config.consumerKey),
    hasConsumerSecret: Boolean(config.consumerSecret),
    consumerSecretPreview: maskKey(config.consumerSecret),
    merchantMsisdn: config.merchantMsisdn || "123000306",
    hasApiKey: Boolean(config.apiKey),
    apiKeyPreview: maskKey(config.apiKey),
    tokenUrl: config.tokenUrl,
    callbackUrl: "https://www.meeemsl.com/api/afrimoney/callback",
  }

  // 2. Step 1: Health check of public bridge domain
  const healthCheck = await checkBridgeHealth(config.bridgeUrl)

  // 3. Step 2: Bridge tunnel test to AfriMoney Gateway
  const tunnelTest = await testBridgeTunnel(config.bridgeUrl, config.bridgeKey)

  // 4. Step 3: OAuth Token test (using Client Credentials)
  const oauthTest = await testOAuthToken(config)

  // 5. Optional Action: Push USSD Test Initiation
  let pushTestResult: any = null
  if (action === "push_test") {
    const testRef = `TEST-${Date.now()}`
    try {
      pushTestResult = await initiateAfriMoneyPushUssd(
        {
          amount: 1,
          payerMsisdn: testMsisdn,
          externalReferenceId: testRef,
          remarks: "Test 1 SLE Push USSD",
        },
        config
      )
    } catch (err: any) {
      pushTestResult = {
        success: false,
        error: err?.message || String(err),
      }
    }
  }

  // 6. Optional Action: Query Transaction Status
  let queryResult: any = null
  if (action === "query_test" && refParam) {
    try {
      queryResult = await queryAfriMoneyTransaction(refParam, config)
    } catch (err: any) {
      queryResult = {
        success: false,
        error: err?.message || String(err),
      }
    }
  }

  // Determine overall readiness
  const isBridgeAlive = healthCheck.ok
  const isTunnelPassing =
    tunnelTest.verdict === "TUNNEL_CONNECTED_AND_GATEWAY_REACHED"
  const isOAuthWorking = oauthTest.success
  const isReadyToProceed = isBridgeAlive && isTunnelPassing && isOAuthWorking

  let nextAction = ""
  if (!config.bridgeKey) {
    nextAction =
      "CRITICAL: Set AFRIMONEY_BRIDGE_KEY in your .env or AWS Amplify Console environment variables."
  } else if (!isBridgeAlive) {
    nextAction =
      "Check server DNS / Nginx status for afrimoney.meeemsl.com (port 443)."
  } else if (tunnelTest.verdict === "VPN_TUNNEL_DOWN_OR_TIMEOUT") {
    nextAction =
      "The strongSwan IPSec VPN tunnel is down or timing out. Contact DevOps to run `sudo swanctl --list-sas`."
  } else if (tunnelTest.verdict === "INVALID_BRIDGE_KEY") {
    nextAction =
      "AFRIMONEY_BRIDGE_KEY in .env does not match the key on the server. Update AFRIMONEY_BRIDGE_KEY."
  } else if (!oauthTest.success) {
    nextAction =
      "OAuth token retrieval failed. Check Consumer Key and Consumer Secret."
  } else {
    nextAction =
      "Everything is 100% OPERATIONAL! Ready to trigger Push USSD payments."
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    readyToProceed: isReadyToProceed,
    verdict: isReadyToProceed ? "READY_TO_PROCEED" : "ATTENTION_REQUIRED",
    nextAction,
    summary: {
      bridgeReachable: isBridgeAlive,
      vpnTunnelConnected: isTunnelPassing,
      oauthConfigured: isOAuthWorking,
    },
    environment: envAudit,
    diagnostics: {
      step1_healthCheck: healthCheck,
      step2_bridgeTunnel: {
        verdict: tunnelTest.verdict,
        httpStatus: tunnelTest.status,
        message: tunnelTest.message,
        responsePreview:
          tunnelTest.body.length > 500
            ? `${tunnelTest.body.slice(0, 500)}...`
            : tunnelTest.body,
      },
      step3_oauthToken: oauthTest,
      step4_pushTest: pushTestResult,
      step5_queryTest: queryResult,
    },
  })
}

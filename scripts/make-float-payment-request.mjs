import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function loadPrivateKey() {
  const certPath = path.resolve(process.cwd(), 'certs/private_key.pem');
  if (fs.existsSync(certPath)) {
    return fs.readFileSync(certPath, 'utf8').trim();
  }
  const altCertPath = path.resolve(process.cwd(), 'certs/flot_private_key.pem');
  if (fs.existsSync(altCertPath)) {
    return fs.readFileSync(altCertPath, 'utf8').trim();
  }
  throw new Error("Private key not found in certs/");
}

function signPayload(payloadStr, privateKey) {
  const signer = crypto.createSign('RSA-SHA512');
  signer.update(payloadStr);
  return signer.sign(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    'base64'
  );
}

async function testCurrency(baseUrl, merchantId, privateKey, currency, amount = "10.00") {
  const orderId = `MEEEM_${Date.now()}`;
  const requestBody = {
    merchantId,
    type: "in-app",
    payload: {
      orderId,
      currency,
      amount,
    },
  };

  const rawJson = JSON.stringify(requestBody);
  const signature = signPayload(rawJson, privateKey);
  const url = `${baseUrl}/merchants/private/v1/payment-links`;

  console.log(`\n============================================================`);
  console.log(`▶ OUTGOING HTTP REQUEST [Target: ${baseUrl}, Currency: ${currency}]`);
  console.log(`============================================================`);
  console.log(`POST ${url}`);
  console.log(`Headers:`);
  console.log(`  Content-Type: application/json`);
  console.log(`  X-Flot-Merchant-Signature: ${signature.slice(0, 40)}... (Length: ${signature.length})`);
  console.log(`Body:`);
  console.log(JSON.stringify(requestBody, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flot-Merchant-Signature': signature,
      },
      body: rawJson,
    });

    const resHeaders = {};
    res.headers.forEach((v, k) => { resHeaders[k] = v; });
    const responseText = await res.text();
    let responseJson = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = responseText;
    }

    console.log(`\n◀ INCOMING HTTP RESPONSE:`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log(`Headers:`, resHeaders);
    console.log(`Body:`);
    console.log(JSON.stringify(responseJson, null, 2));

    return { status: res.status, ok: res.ok, data: responseJson };
  } catch (err) {
    console.error(`❌ Request Failed:`, err);
    return { ok: false, error: err.message };
  }
}

async function run() {
  const merchantId = "40bd76d6-de05-4ca3-9e32-47eed6e657b1";
  const privateKey = loadPrivateKey();

  console.log("Merchant ID:", merchantId);
  console.log("Private Key loaded successfully (RSA-4096)");

  // 1. Test Production endpoint with SLE
  console.log("\n--- TEST 1: PRODUCTION (api.app.flotme.ai) with SLE ---");
  await testCurrency("https://api.app.flotme.ai", merchantId, privateKey, "SLE");

  console.log("\n--- TEST 1B: PRODUCTION with USD ---");
  await testCurrency("https://api.app.flotme.ai", merchantId, privateKey, "USD");

  console.log("\n--- TEST 1C: PRODUCTION with SLL ---");
  await testCurrency("https://api.app.flotme.ai", merchantId, privateKey, "SLL");
}

run();

const crypto = require('crypto');
const fs = require('fs');

// Load the private key from a file
const privateKey = fs.readFileSync('private_key.pem', 'utf8');

const canonicalRequestString = "GET\n/merchants/private/v1/external-orders/some-test-order-id-62342352/payment-attempts/d8cd7824-2763-4e17-aba3-56e8fbd2090c";

// Create a signer object
const signer = crypto.createSign('RSA-SHA512');

console.log("Canonical request string:", canonicalRequestString)

// Update the signer with the data
signer.update(canonicalRequestString);

// Sign the data using the private key with PSS padding
const signature = signer.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
}, 'base64');

console.log('Signature:', signature);

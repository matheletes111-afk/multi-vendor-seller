const crypto = require('crypto');
const fs = require('fs');

// Load the private key from a file
const privateKey = fs.readFileSync('private_key.pem', 'utf8');

// Request body to be signed
const requestBody = {
    "merchantId": "6efaa63d-c1eb-49eb-bdb7-ca24a6f3637e",
    "type": "in-app",
    "payload": {
        "orderId":"some-test-order-id-12345",
        "currency":"SLE",
        "amount":"10",
    }
};

// Create a signer object
const signer = crypto.createSign('RSA-SHA512');

console.log("Stringified request body:", JSON.stringify(requestBody))

// Update the signer with the data
signer.update(JSON.stringify(requestBody));

// Sign the data using the private key with PSS padding
const signature = signer.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
}, 'base64');

console.log('Signature:', signature);


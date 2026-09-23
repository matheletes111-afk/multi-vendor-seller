import crypto from "crypto"
import { getFlotPrivateKey } from "../src/lib/flot"

/**
 * Utility script to extract the exact matching RSA-4096 Public Key
 * directly from your FLOT_PRIVATE_KEY (either from .env or certs folder).
 */
function extractMatchingPublicKey() {
  console.log("Reading FLOT_PRIVATE_KEY...")

  try {
    const privateKeyPem = getFlotPrivateKey()
    
    // Mathematically derive the exact matching Public Key from the Private Key
    const publicKeyObject = crypto.createPublicKey(privateKeyPem)
    const publicKeyPem = publicKeyObject.export({
      type: "spki",
      format: "pem",
    })

    console.log("\n=======================================================")
    console.log("       EXACT MATCHING PUBLIC KEY FOR FLOAT TEAM        ")
    console.log("=======================================================\n")
    console.log(publicKeyPem)
    console.log("=======================================================")
    console.log("Give the above Public Key to Float support team.")
    console.log("It is 100% mathematically paired with your Private Key.")
    console.log("=======================================================\n")
  } catch (error: any) {
    console.error("Error reading or deriving public key:", error?.message)
  }
}

extractMatchingPublicKey()

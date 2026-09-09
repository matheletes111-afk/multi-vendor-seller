package main

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"log"
)

// Function to load the RSA private key from a PEM file
func loadPrivateKey(filename string) (*rsa.PrivateKey, error) {
	// Read the private key file
	keyData, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	// Decode the PEM data
	block, _ := pem.Decode(keyData)
	if block == nil || block.Type != "PRIVATE KEY" {
		return nil, fmt.Errorf("failed to decode PEM block containing private key")
	}

	// Parse the RSA private key
	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	return privateKey.(*rsa.PrivateKey), nil
}

// Function to sign payload
func signPayload(privateKey *rsa.PrivateKey, payload []byte) (string, error) {
	// Step 1: Hash the payload using SHA-512
	hashed := sha512.Sum512(payload)

	// Step 2: Sign the hash with PSS padding
	signature, err := rsa.SignPSS(rand.Reader, privateKey, crypto.SHA512, hashed[:], &rsa.PSSOptions{
		SaltLength: rsa.PSSSaltLengthEqualsHash,
		Hash:       crypto.SHA512,
	})
	if err != nil {
		return "", err
	}

	// Step 3: Encode the signature in Base64
	signatureBase64 := base64.StdEncoding.EncodeToString(signature)

	return signatureBase64, nil
}

type Payload struct {
	OrderID  string `json:"orderId"`
	Currency string `json:"currency"`
	Amount   string `json:"amount"`
}

type PaymentLinkRequestBody struct {
	MerchantID string  `json:"merchantId"`
	Type       string  `json:"type"`
	Payload    Payload `json:"payload"`
}

func main() {
	// Example payload

	requestBody := PaymentLinkRequestBody{
		MerchantID: "6efaa63d-c1eb-49eb-bdb7-ca24a6f3637e",
		Type:       "in-app",
		Payload: Payload{
			OrderID:  "some-test-order-id-12345",
			Currency: "SLE",
			Amount:   "10",
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		log.Fatalf("Error marshalling request body into JSON: %v", err)
	}

	fmt.Println("Stringified JSON data:", string(jsonData))

	// Load your RSA private key from a file
	privateKey, err := loadPrivateKey("private_key.pem")
	if err != nil {
		log.Fatalf("Error loading private key: %v", err)
	}

	// Sign the payload
	signature, err := signPayload(privateKey, jsonData)
	if err != nil {
		log.Fatal(err)
	}

	// Print the Base64 encoded signature
	fmt.Println("Base64 Encoded Signature:", signature)
}

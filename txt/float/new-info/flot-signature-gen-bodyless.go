package main

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"log"
	"os"
)

func loadPrivateKey(filename string) (*rsa.PrivateKey, error) {
	keyData, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(keyData)
	if block == nil || block.Type != "PRIVATE KEY" {
		return nil, fmt.Errorf("failed to decode PEM block containing private key")
	}

	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	rsaPrivateKey, ok := privateKey.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}

	return rsaPrivateKey, nil
}

func signPayload(privateKey *rsa.PrivateKey, payload []byte) (string, error) {
	hashed := sha512.Sum512(payload)

	signature, err := rsa.SignPSS(rand.Reader, privateKey, crypto.SHA512, hashed[:], &rsa.PSSOptions{
		SaltLength: rsa.PSSSaltLengthEqualsHash,
		Hash:       crypto.SHA512,
	})
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(signature), nil
}

func canonicalRequestString(method, path string) string {
	return fmt.Sprintf("%s\n%s", method, path)
}

func main() {
	method := "GET"
	path := "/merchants/private/v1/external-orders/my-another-order-7342526/payment-attempts/19544284-fd05-4f1c-8017-ac54e0850b68"

	dataToSign := canonicalRequestString(method, path)

	fmt.Println("Canonical request string:")
	fmt.Println(dataToSign)

	privateKey, err := loadPrivateKey("private_key.pem")
	if err != nil {
		log.Fatalf("Error loading private key: %v", err)
	}

	signature, err := signPayload(privateKey, []byte(dataToSign))
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Base64 Encoded Signature:", signature)
}

import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
})

export async function createCheckoutSession(params: {
  lineItems: Array<{ price: string; quantity: number }>
  customerId?: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}) {
  return await stripe.checkout.sessions.create({
    mode: "payment",
    ...params,
    payment_method_types: ["card"],
  })
}

export async function createSubscriptionSession(params: {
  priceId: string
  customerId?: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}) {
  return await stripe.checkout.sessions.create({
    mode: "subscription",
    ...params,
    payment_method_types: ["card"],
  })
}


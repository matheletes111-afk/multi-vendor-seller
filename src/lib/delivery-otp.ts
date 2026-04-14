import { randomInt } from "crypto"
import { sendEmail } from "./email"
import { sendSmsViaTwilio, normalizePhoneNumber } from "./twilio-sms"

/**
 * Generates a 6-digit Delivery OTP and sends it to the customer via Email and SMS.
 */
export async function sendDeliveryOtp({
  toEmail,
  toPhone,
  orderNumber,
  customerName,
}: {
  toEmail: string
  toPhone: string | null
  orderNumber: string
  customerName: string | null
}) {
  const otp = randomInt(100000, 999999).toString()
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  const subject = `Your order ${orderNumber} is out for delivery`
  const message = `Your order #${orderNumber} is out for delivery. Share OTP ${otp} with the delivery partner to receive your package.`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Out for Delivery</h2>
        <p style="color: #666; line-height: 1.6;">
          ${customerName ? `Hi ${customerName},` : "Hi there,"}
        </p>
        <p style="color: #666; line-height: 1.6;">
          Your order <strong>#${orderNumber}</strong> is out for delivery!
        </p>
        <p style="color: #666; line-height: 1.6;">
          Please share the following 6-digit OTP with the delivery partner to receive your package:
        </p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #28a745; margin: 24px 0; text-align: center;">
          ${otp}
        </p>
        <p style="color: #999; font-size: 12px;">
          This code is required for successful delivery. Do not share it until the delivery partner is at your doorstep.
        </p>
      </div>
    </div>
  `

  const emailPromise = sendEmail({ to: toEmail, subject, html, text: message })
  
  let smsPromise = Promise.resolve()
  if (toPhone) {
    const normalized = normalizePhoneNumber(toPhone)
    if (normalized) {
      smsPromise = sendSmsViaTwilio({ to: normalized, body: message }).catch(err => {
        console.error("Failed to send delivery OTP SMS:", err)
      })
    }
  }

  await Promise.allSettled([emailPromise, smsPromise])

  return { otp, expiry }
}

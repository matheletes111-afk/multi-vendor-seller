import sgMail from "@sendgrid/mail"

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html?: string
  text?: string
}) {
  const apiKey = process.env.SENDGRID_API_KEY?.trim()
  const from = process.env.SENDGRID_FROM_EMAIL?.trim()
  if (!apiKey || !from) {
    console.warn("SendGrid not configured: SENDGRID_API_KEY or SENDGRID_FROM_EMAIL missing or empty")
    return { success: false, error: new Error("Email not configured") }
  }
  sgMail.setApiKey(apiKey)
  try {
    const content = html
      ? [{ type: "text/html" as const, value: html }]
      : text && text.length > 0
        ? [{ type: "text/plain" as const, value: text }]
        : [{ type: "text/plain" as const, value: " " }]
    const msg = {
      to,
      from,
      subject,
      content,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sgMail.send(msg as any)
    return { success: true, data: result[0] }
  } catch (err: unknown) {
    const error = err as { response?: { body?: unknown; statusCode?: number } }
    const body = error.response?.body
    const status = error.response?.statusCode
    console.error("Email send failed:", status ?? err, body ?? err)
    if (status === 403 && body && typeof body === "object" && "errors" in body) {
      console.error("SendGrid 403: Check that SENDGRID_FROM_EMAIL is a verified sender in your SendGrid account.")
    }
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function sendVerificationEmail({
  to,
  verificationLink,
  name,
}: {
  to: string
  verificationLink: string
  name?: string | null
}) {
  const subject = "Verify Your Email Address"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Email Verification Required</h2>
        <p style="color: #666; line-height: 1.6;">
          ${name ? `Hi ${name},` : "Hi there,"}
        </p>
        <p style="color: #666; line-height: 1.6;">
          Please verify your email address by clicking the button below:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #666; line-height: 1.6; font-size: 14px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="color: #007bff; word-break: break-all; font-size: 12px;">
          ${verificationLink}
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 24 hours.
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendVerificationOtpEmail({
  to,
  otp,
  name,
}: {
  to: string
  otp: string
  name?: string | null
}) {
  const subject = "Your verification code"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Email Verification</h2>
        <p style="color: #666; line-height: 1.6;">
          ${name ? `Hi ${name},` : "Hi there,"}
        </p>
        <p style="color: #666; line-height: 1.6;">
          Your 6-digit verification code is:
        </p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #007bff; margin: 24px 0;">
          ${otp}
        </p>
        <p style="color: #999; font-size: 12px;">
          This code will expire in 10 minutes. Do not share it with anyone.
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

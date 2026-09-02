import sgMail from "@sendgrid/mail"
import { formatCurrency } from "@/lib/utils"

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
    const error = err as { response?: { body?: { errors?: Array<{ message: string }> }; statusCode?: number } }
    const body = error.response?.body
    const status = error.response?.statusCode
    console.error("Email send failed:", status ?? err, body ?? err)
    let errMsg = "SendGrid failed to send email."
    if (body && body.errors && body.errors.length > 0) {
      errMsg = `SendGrid error (${status}): ${body.errors.map((e: any) => e.message).join(", ")}`
    } else if (err instanceof Error) {
      errMsg = err.message
    } else {
      errMsg = String(err)
    }
    return { success: false, error: new Error(errMsg) }
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
  verificationLink,
}: {
  to: string
  otp: string
  name?: string | null
  verificationLink?: string
}) {
  const subject = "Your verification code"
  const linkSection = verificationLink
    ? `
        <div style="text-align: center; margin: 24px 0 16px;">
          <a href="${verificationLink}" 
             style="background-color: #007bff; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #666; font-size: 13px; margin-bottom: 8px;">Or copy and paste this link:</p>
        <p style="color: #007bff; word-break: break-all; font-size: 12px; margin-bottom: 20px;">
          ${verificationLink}
        </p>
      `
    : ""

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
        ${linkSection}
        <p style="color: #999; font-size: 12px;">
          This code will expire in 10 minutes. Do not share it with anyone.
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendPasswordResetOtpEmail({
  to,
  otp,
  name,
  resetLink,
}: {
  to: string
  otp: string
  name?: string | null
  resetLink?: string
}) {
  const subject = "Your password reset code"
  const linkSection = resetLink
    ? `
        <div style="text-align: center; margin: 24px 0 16px;">
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 13px; margin-bottom: 8px;">Or copy and paste this link:</p>
        <p style="color: #007bff; word-break: break-all; font-size: 12px; margin-bottom: 20px;">
          ${resetLink}
        </p>
      `
    : ""

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Reset your password</h2>
        <p style="color: #666; line-height: 1.6;">
          ${name ? `Hi ${name},` : "Hi there,"}
        </p>
        <p style="color: #666; line-height: 1.6;">
          Use this 6-digit code to reset your password:
        </p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #007bff; margin: 24px 0;">
          ${otp}
        </p>
        ${linkSection}
        <p style="color: #999; font-size: 12px;">
          This code will expire in 10 minutes. Do not share it with anyone.
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendLoginOtpEmail({
  to,
  otp,
  name,
}: {
  to: string
  otp: string
  name?: string | null
}) {
  const subject = "Your login OTP code"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Login verification code</h2>
        <p style="color: #666; line-height: 1.6;">
          ${name ? `Hi ${name},` : "Hi there,"}
        </p>
        <p style="color: #666; line-height: 1.6;">
          Use this 6-digit OTP to login:
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

// ── CUSTOMER ORDER CONFIRMATION EMAIL ────────────────────────────────────────
export async function sendOrderConfirmationEmail({
  to,
  name,
  orderNumber,
  items,
  subtotal,
  tax,
  shipping,
  totalAmount,
  shippingAddress,
  paymentMethod,
}: {
  to: string
  name: string
  orderNumber: string
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>
  subtotal: number
  tax: number
  shipping: number
  totalAmount: number
  shippingAddress: string
  paymentMethod: string
}) {
  const subject = `Order Confirmation - #${orderNumber}`
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name} (x${item.quantity})</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.price)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `
    )
    .join("")

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #333; margin-bottom: 5px;">Thank you for your order!</h2>
        <p style="color: #666; font-size: 14px; margin-top: 0; margin-bottom: 20px;">Order #${orderNumber}</p>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">We have received your order and are processing it. Below are your order details:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 10px; text-align: left; font-size: 14px;">Item</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">Price</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; margin-top: 15px; color: #555;">
          <p style="margin: 5px 0;">Subtotal: <strong>${formatCurrency(subtotal)}</strong></p>
          <p style="margin: 5px 0;">GST/Tax: <strong>${formatCurrency(tax)}</strong></p>
          <p style="margin: 5px 0;">Shipping: <strong>${formatCurrency(shipping)}</strong></p>
          <h3 style="margin: 10px 0; color: #007bff;">Total: ${formatCurrency(totalAmount)}</h3>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #555; margin-bottom: 5px;"><strong>Shipping Address:</strong></p>
          <p style="color: #666; font-size: 14px; margin-top: 0; line-height: 1.5;">${shippingAddress}</p>
          <p style="color: #555; margin-top: 15px; margin-bottom: 5px;"><strong>Payment Method:</strong></p>
          <p style="color: #666; font-size: 14px; margin-top: 0;">${paymentMethod}</p>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── SELLER NEW ORDER ITEM NOTIFICATION ────────────────────────────────────────
export async function sendSellerNewOrderEmail({
  to,
  sellerName,
  orderNumber,
  items,
  customerName,
  shippingAddress,
  shippingPhone,
}: {
  to: string
  sellerName: string
  orderNumber: string
  items: Array<{ name: string; quantity: number; subtotal: number }>
  customerName: string
  shippingAddress: string
  shippingPhone: string
}) {
  const subject = `New Order Received - #${orderNumber}`
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name} (x${item.quantity})</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `
    )
    .join("")

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #007bff; margin-bottom: 5px;">New Order Notification</h2>
        <p style="color: #666; font-size: 14px; margin-top: 0; margin-bottom: 20px;">Order #${orderNumber}</p>
        <p style="color: #666; line-height: 1.6;">Hi ${sellerName},</p>
        <p style="color: #666; line-height: 1.6;">You have received a new order. Please prepare and dispatch the following items:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 10px; text-align: left; font-size: 14px;">Item</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #555; margin-bottom: 5px;"><strong>Customer Delivery Details:</strong></p>
          <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">Name: ${customerName}</p>
          <p style="color: #666; font-size: 14px; margin: 5px 0; line-height: 1.5;">Address: ${shippingAddress}</p>
          <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">Phone: ${shippingPhone}</p>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── ADMIN NEW ORDER NOTIFICATION ───────────────────────────────────────────
export async function sendAdminNewOrderEmail({
  to,
  orderNumber,
  customerName,
  items,
  totalAmount,
  commissionAmount,
}: {
  to: string
  orderNumber: string
  customerName: string
  items: Array<{ name: string; quantity: number; sellerStoreName: string; subtotal: number }>
  totalAmount: number
  commissionAmount: number
}) {
  const subject = `New Order Placed - #${orderNumber}`
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name} (x${item.quantity})</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.sellerStoreName}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `
    )
    .join("")

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #28a745; margin-bottom: 5px;">Admin Order Alert</h2>
        <p style="color: #666; font-size: 14px; margin-top: 0; margin-bottom: 20px;">Order #${orderNumber}</p>
        <p style="color: #666; line-height: 1.6;">Hi Admin,</p>
        <p style="color: #666; line-height: 1.6;">A new order has been placed by <strong>${customerName}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 10px; text-align: left; font-size: 14px;">Item</th>
              <th style="padding: 10px; text-align: left; font-size: 14px;">Seller Store</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; margin-top: 15px; color: #555;">
          <p style="margin: 5px 0;">Total Amount: <strong>${formatCurrency(totalAmount)}</strong></p>
          <p style="margin: 5px 0; color: #28a745;">Commission Earned: <strong>${formatCurrency(commissionAmount)}</strong></p>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── CUSTOMER ORDER ITEM STATUS UPDATE EMAIL ──────────────────────────────────
export async function sendOrderItemStatusUpdateEmail({
  to,
  name,
  orderNumber,
  itemName,
  status,
}: {
  to: string
  name: string
  orderNumber: string
  itemName: string
  status: string
}) {
  const subject = `Update on Order #${orderNumber}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #007bff; margin-bottom: 20px;">Item Status Update</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          The status of your item <strong>${itemName}</strong> in order <strong>#${orderNumber}</strong> has been updated to:
        </p>
        <p style="font-size: 20px; font-weight: bold; color: #007bff; margin: 20px 0; text-transform: uppercase;">
          ${status}
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── FOOD ORDER CONFIRMATION EMAIL ───────────────────────────────────────────
export async function sendFoodOrderConfirmationEmail({
  to,
  name,
  orderNumber,
  items,
  totalAmount,
  deliveryAddress,
  paymentMethod,
}: {
  to: string
  name: string
  orderNumber: string
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>
  totalAmount: number
  deliveryAddress: string
  paymentMethod: string
}) {
  const subject = `Food Order Confirmation - #${orderNumber}`
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name} (x${item.quantity})</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.price)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `
    )
    .join("")

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #333; margin-bottom: 5px;">Food Order Placed!</h2>
        <p style="color: #666; font-size: 14px; margin-top: 0; margin-bottom: 20px;">Order #${orderNumber}</p>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">Your order is being sent to the kitchen. Here is a summary of your food items:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 10px; text-align: left; font-size: 14px;">Food Item</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">Price</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; margin-top: 15px; color: #555;">
          <h3 style="margin: 10px 0; color: #007bff;">Total paid: ${formatCurrency(totalAmount)}</h3>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #555; margin-bottom: 5px;"><strong>Delivery Address:</strong></p>
          <p style="color: #666; font-size: 14px; margin-top: 0; line-height: 1.5;">${deliveryAddress}</p>
          <p style="color: #555; margin-top: 15px; margin-bottom: 5px;"><strong>Payment Method:</strong></p>
          <p style="color: #666; font-size: 14px; margin-top: 0;">${paymentMethod}</p>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── RESTAURANT SELLER NEW FOOD ORDER NOTIFICATION ─────────────────────────────────
export async function sendRestaurantNewOrderEmail({
  to,
  restaurantName,
  orderNumber,
  items,
  customerName,
  deliveryAddress,
  deliveryPhone,
}: {
  to: string
  restaurantName: string
  orderNumber: string
  items: Array<{ name: string; quantity: number }>
  customerName: string
  deliveryAddress: string
  deliveryPhone: string
}) {
  const subject = `New Food Order - #${orderNumber}`
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">x${item.quantity}</td>
      </tr>
    `
    )
    .join("")

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #007bff; margin-bottom: 5px;">Incoming Food Order</h2>
        <p style="color: #666; font-size: 14px; margin-top: 0; margin-bottom: 20px;">Order #${orderNumber}</p>
        <p style="color: #666; line-height: 1.6;">Hi ${restaurantName},</p>
        <p style="color: #666; line-height: 1.6;">You have a new food order from <strong>${customerName}</strong>. Please check the items below:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #e9ecef;">
              <th style="padding: 10px; text-align: left; font-size: 14px;">Food Item</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #555; margin-bottom: 5px;"><strong>Delivery Details:</strong></p>
          <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">Address: ${deliveryAddress}</p>
          <p style="color: #666; font-size: 14px; margin: 5px 0; line-height: 1.5;">Phone: ${deliveryPhone}</p>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── CUSTOMER FOOD ORDER STATUS UPDATE EMAIL ──────────────────────────────────
export async function sendFoodOrderStatusUpdateEmail({
  to,
  name,
  orderNumber,
  status,
}: {
  to: string
  name: string
  orderNumber: string
  status: string
}) {
  const subject = `Update on Food Order #${orderNumber}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #007bff; margin-bottom: 20px;">Food Order Update</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          The status of your food order <strong>#${orderNumber}</strong> has been updated to:
        </p>
        <p style="font-size: 20px; font-weight: bold; color: #007bff; margin: 20px 0; text-transform: uppercase;">
          ${status}
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── HOTEL BOOKING CONFIRMATION EMAIL ─────────────────────────────────────────
export async function sendHotelBookingConfirmationEmail({
  to,
  name,
  hotelName,
  roomName,
  guestName,
  guestPhone,
  checkInDate,
  checkOutDate,
  numberOfRooms,
  totalPrice,
}: {
  to: string
  name: string
  hotelName: string
  roomName: string
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  numberOfRooms: number
  totalPrice: number
}) {
  const subject = `Hotel Booking Confirmation - ${hotelName}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #007bff; margin-bottom: 5px;">Hotel Booking Confirmed!</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">Your booking at <strong>${hotelName}</strong> is verified. Here are the booking details:</p>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #e9ecef;">
          <p style="margin: 5px 0; color: #555;"><strong>Hotel:</strong> ${hotelName}</p>
          <p style="margin: 5px 0; color: #555;"><strong>Room:</strong> ${roomName} (x${numberOfRooms})</p>
          <p style="margin: 5px 0; color: #555;"><strong>Check-in:</strong> ${checkInDate}</p>
          <p style="margin: 5px 0; color: #555;"><strong>Check-out:</strong> ${checkOutDate}</p>
          <p style="margin: 5px 0; color: #555;"><strong>Guest:</strong> ${guestName} (${guestPhone})</p>
          <h3 style="margin: 15px 0 0 0; color: #007bff;">Total Price: ${formatCurrency(totalPrice)}</h3>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── HOTEL SELLER NEW BOOKING NOTIFICATION ──────────────────────────────────────
export async function sendHotelNewBookingEmail({
  to,
  hotelSellerName,
  hotelName,
  roomName,
  guestName,
  guestPhone,
  checkInDate,
  checkOutDate,
  numberOfRooms,
  totalPrice,
}: {
  to: string
  hotelSellerName: string
  hotelName: string
  roomName: string
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  numberOfRooms: number
  totalPrice: number
}) {
  const subject = `New Hotel Booking Received - ${hotelName}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #007bff; margin-bottom: 5px;">New Booking Notification</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${hotelSellerName},</p>
        <p style="color: #666; line-height: 1.6;">You have received a new booking at <strong>${hotelName}</strong>:</p>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #e9ecef;">
          <p style="margin: 5px 0; color: #555;"><strong>Room:</strong> ${roomName} (x${numberOfRooms})</p>
          <p style="margin: 5px 0; color: #555;"><strong>Check-in:</strong> ${checkInDate}</p>
          <p style="margin: 5px 0; color: #555;"><strong>Check-out:</strong> ${checkOutDate}</p>
          <p style="margin: 5px 0; color: #555;"><strong>Guest:</strong> ${guestName} (${guestPhone})</p>
          <h3 style="margin: 15px 0 0 0; color: #007bff;">Total Revenue: ${formatCurrency(totalPrice)}</h3>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── CUSTOMER HOTEL BOOKING STATUS UPDATE EMAIL ──────────────────────────────
export async function sendHotelBookingStatusUpdateEmail({
  to,
  name,
  hotelName,
  status,
}: {
  to: string
  name: string
  hotelName: string
  status: string
}) {
  const subject = `Booking Update - ${hotelName}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #333; margin-bottom: 20px; color: #007bff;">Booking Status Update</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Your booking status at <strong>${hotelName}</strong> has been updated to:
        </p>
        <p style="font-size: 20px; font-weight: bold; color: #007bff; margin: 20px 0; text-transform: uppercase;">
          ${status}
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── SELLER LIFECYCLE & REGISTRATION EMAILS ───────────────────────────────────
export async function sendSellerWelcomeEmail({
  to,
  name,
}: {
  to: string
  name: string
}) {
  const subject = "Welcome to Our Platform - Verification Pending"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #333; margin-bottom: 20px; color: #007bff;">Registration Received</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Thank you for registering as a seller on our platform. Your profile is currently under review by our administration team.
        </p>
        <p style="color: #666; line-height: 1.6;">
          We will notify you by email as soon as your account status is updated.
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendAdminNewSellerAlertEmail({
  to,
  sellerName,
  sellerEmail,
  sellerRole,
}: {
  to: string
  sellerName: string
  sellerEmail: string
  sellerRole: string
}) {
  const subject = "New Seller Onboarding Action Required"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e9ecef;">
        <h2 style="color: #333; margin-bottom: 20px; color: #28a745;">New Seller Registered</h2>
        <p style="color: #666; line-height: 1.6;">Hi Admin,</p>
        <p style="color: #666; line-height: 1.6;">
          A new seller has completed registration and is pending approval:
        </p>
        <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; border: 1px solid #eee; margin: 15px 0;">
          <p style="margin: 5px 0; color: #555;"><strong>Name:</strong> ${sellerName}</p>
          <p style="margin: 5px 0; color: #555;"><strong>Email:</strong> ${sellerEmail}</p>
          <p style="margin: 5px 0; color: #555;"><strong>Role:</strong> ${sellerRole}</p>
        </div>
        <p style="color: #666; line-height: 1.6;">Please log in to the admin dashboard to review their credentials.</p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendSellerApprovalEmail({
  to,
  name,
}: {
  to: string
  name: string
}) {
  const subject = "Your Seller Account Has Been Approved!"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #28a745;">
        <h2 style="color: #28a745; margin-bottom: 20px;">Account Approved</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Great news! Your seller profile has been approved by the admin. You can now log in, list your products/services, and start selling.
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendSellerSuspensionEmail({
  to,
  name,
  isSuspended,
}: {
  to: string
  name: string
  isSuspended: boolean
}) {
  const subject = isSuspended ? "Your Seller Account Has Been Suspended" : "Your Seller Account Has Been Reactivated"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid ${isSuspended ? "#dc3545" : "#28a745"};">
        <h2 style="color: ${isSuspended ? "#dc3545" : "#28a745"}; margin-bottom: 20px;">Account Status Update</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Your seller account has been <strong>${isSuspended ? "SUSPENDED" : "REACTIVATED"}</strong> by the administration team.
        </p>
        ${!isSuspended ? `<p style="color: #666; line-height: 1.6;">You can now log in and resume selling on the platform.</p>` : `<p style="color: #666; line-height: 1.6;">Please contact support if you believe this is a mistake.</p>`}
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendRiderSuspensionEmail({
  to,
  name,
  isSuspended,
}: {
  to: string
  name: string
  isSuspended: boolean
}) {
  const subject = isSuspended
    ? "Your Delivery Rider Account Has Been Suspended"
    : "Your Delivery Rider Account Has Been Reactivated"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid ${isSuspended ? "#dc3545" : "#28a745"};">
        <h2 style="color: ${isSuspended ? "#dc3545" : "#28a745"}; margin-bottom: 20px;">Rider Account Status Update</h2>
        <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Your delivery rider account has been <strong>${isSuspended ? "SUSPENDED" : "REACTIVATED"}</strong> by the administration team.
        </p>
        ${!isSuspended ? `<p style="color: #666; line-height: 1.6;">You can now log in and resume accepting delivery requests on the platform.</p>` : `<p style="color: #666; line-height: 1.6;">Please contact support if you believe this is an error or have questions.</p>`}
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendSupportTicketReplyEmail({
  to,
  recipientName,
  ticketId,
  subject,
  replyMessage,
  isClosed,
}: {
  to: string
  recipientName: string
  ticketId: string
  subject?: string | null
  replyMessage: string
  isClosed?: boolean
}) {
  const emailSubject = `[${ticketId}] Reply to Your Support Request: ${subject || "Support Inquiry"}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc;">
      <div style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">MEEEM Support Desk</h2>
          <p style="margin: 0; font-size: 13px; color: #64748b; font-family: monospace;">Ticket ID: <strong>${ticketId}</strong></p>
        </div>

        <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">Dear <strong>${recipientName}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">Our customer and vendor support team has reviewed your inquiry and replied:</p>

        <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 18px 20px; margin: 20px 0; font-size: 14px; line-height: 1.7; color: #0f172a; white-space: pre-wrap;">
${replyMessage}
        </div>

        ${isClosed ? `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #065f46;">
          <strong>Ticket Status:</strong> This support ticket has been marked as <strong>Resolved / Closed</strong>. If you still have questions, you may reply to this email or submit a new inquiry at our support portal.
        </div>` : ''}

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 28px; font-size: 13px; color: #64748b; line-height: 1.5;">
          <p style="margin: 0 0 4px 0;"><strong>MEEEM E-commerce Ltd.</strong></p>
          <p style="margin: 0;">Support Email: <a href="mailto:support@meeemsl.com" style="color: #4f46e5; text-decoration: none;">support@meeemsl.com</a> | Website: <a href="https://meeemsl.com" style="color: #4f46e5; text-decoration: none;">meeemsl.com</a></p>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject: emailSubject, html })
}

export async function sendRiderWelcomeEmail({
  to,
  name,
  temporaryPassword,
  loginUrl,
}: {
  to: string
  name?: string | null
  temporaryPassword: string
  loginUrl: string
}) {
  const subject = "Welcome to MEEEM Delivery Network - Your Rider Account Details"
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc;">
      <div style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background-color: #eff6ff; border-radius: 50%; padding: 12px; margin-bottom: 12px;">
            <span style="font-size: 28px;">🚴</span>
          </div>
          <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 22px; font-weight: 700;">Welcome to MEEEM Delivery!</h2>
          <p style="color: #64748b; margin: 0; font-size: 14px;">Your rider account has been created by the administrator.</p>
        </div>

        <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">Hi <strong>${name || "Rider"}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          You can now log in to the <strong>MEEEM Rider Portal</strong> using your credentials below:
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <div style="margin-bottom: 12px;">
            <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 4px;">Login Email</span>
            <strong style="font-size: 16px; color: #0f172a; font-family: monospace;">${to}</strong>
          </div>
          <div>
            <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 4px;">Auto-generated Password</span>
            <code style="display: inline-block; background-color: #e0e7ff; color: #3730a3; padding: 6px 14px; border-radius: 6px; font-size: 17px; font-weight: 700; letter-spacing: 1px;">${temporaryPassword}</code>
          </div>
        </div>

        <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #92400e;">
          ⚠️ <strong>First Login Notice:</strong> When you log in for the first time, you will be prompted to change your password, upload your profile photo & documents, and select your preferred delivery zones.
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" 
             style="background-color: #2563eb; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
            Access Rider Portal
          </a>
        </div>

        <p style="color: #64748b; line-height: 1.5; font-size: 13px; text-align: center;">
          Or open this link in your browser:<br/>
          <a href="${loginUrl}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${loginUrl}</a>
        </p>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 28px; font-size: 12px; color: #94a3b8; text-align: center;">
          <p style="margin: 0 0 4px 0;"><strong>MEEEM Marketplace & Logistics</strong></p>
          <p style="margin: 0;">Support: <a href="mailto:support@meeemsl.com" style="color: #2563eb; text-decoration: none;">support@meeemsl.com</a></p>
        </div>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendRiderVerificationEmail({
  to,
  verificationLink,
  name,
  otp,
}: {
  to: string
  verificationLink: string
  name?: string | null
  otp?: string | null
}) {
  const subject = "Verify Your Email - MEEEM Rider Portal"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Welcome to MEEEM Delivery Network</h2>
        <p style="color: #666; line-height: 1.6;">
          ${name ? `Hi ${name},` : "Hi there,"}
        </p>
        <p style="color: #666; line-height: 1.6;">
          Thank you for registering as a delivery rider. Please verify your email address by entering the 6-digit code below or clicking the verification button:
        </p>
        ${
          otp
            ? `
        <div style="background-color: #eff6ff; border: 1px dashed #3b82f6; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 5px 0; font-size: 13px; color: #1e40af; font-weight: 600;">YOUR 6-DIGIT VERIFICATION CODE</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1d4ed8; font-family: monospace;">${otp}</div>
        </div>
        `
            : ""
        }
        <div style="text-align: center; margin: 25px 0;">
          <a href="${verificationLink}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Verify Email & Login
          </a>
        </div>
        <p style="color: #666; line-height: 1.6; font-size: 14px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="color: #2563eb; word-break: break-all; font-size: 12px;">
          ${verificationLink}
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This code and link will expire in 10 minutes.
        </p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── SELLER ONBOARDING & PENDING DOCUMENTS REMINDER EMAIL ──────────────────────
export async function sendSellerOnboardingReminderEmail({
  to,
  sellerName,
  businessName,
  sellerType,
  onboardingUrl,
  missingDocuments = [],
  missingSteps = [],
  currentStep = 2,
  totalSteps = 6,
  freeMonths = 2,
}: {
  to: string
  sellerName?: string | null
  businessName?: string | null
  sellerType?: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" | string
  onboardingUrl: string
  missingDocuments?: string[]
  missingSteps?: string[]
  currentStep?: number
  totalSteps?: number
  freeMonths?: number
}) {
  const displayName = sellerName?.trim() || businessName?.trim() || "Valued Partner"
  const typeLabel =
    sellerType === "HOTEL"
      ? "Hotel & Hospitality Partner"
      : sellerType === "RESTAURANT"
      ? "Restaurant & Food Partner"
      : sellerType === "SERVICE"
      ? "Service Provider"
      : "Product Seller"

  const subject = `Action Required: Complete your onboarding for ${freeMonths} Months Free Access on MEEEM!`

  // Build missing documents list HTML
  const missingDocsHtml =
    missingDocuments.length > 0
      ? missingDocuments
          .map(
            (doc) => `
        <li style="margin-bottom: 8px; color: #b45309; font-size: 14px; line-height: 1.5;">
          <strong style="color: #92400e;">• ${doc}</strong>
        </li>`
          )
          .join("")
      : `
        <li style="margin-bottom: 8px; color: #b45309; font-size: 14px; line-height: 1.5;">
          <strong style="color: #92400e;">• Business verification documents pending review</strong>
        </li>`

  // Build missing steps HTML if available
  const missingStepsHtml =
    missingSteps.length > 0
      ? `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #fde68a;">
        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #78350f;">Pending Setup Steps:</p>
        <ul style="margin: 0; padding-left: 18px; color: #92400e; font-size: 13px;">
          ${missingSteps.map((s) => `<li style="margin-bottom: 4px;">${s}</li>`).join("")}
        </ul>
      </div>`
      : ""

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f1f5f9; color: #1e293b;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 32px 28px; text-align: center;">
                  <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border-radius: 24px; padding: 6px 16px; margin-bottom: 14px; border: 1px solid rgba(255, 255, 255, 0.25);">
                    <span style="color: #fef08a; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                      🎁 Exclusive Partner Offer • ${freeMonths} Months Free
                    </span>
                  </div>
                  <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 24px; font-weight: 800; line-height: 1.3;">
                    Complete Your Onboarding
                  </h1>
                  <p style="color: #c7d2fe; margin: 0; font-size: 15px; font-weight: 500;">
                    MEEEM Multi-Vendor Marketplace (${typeLabel})
                  </p>
                </td>
              </tr>

              <!-- BODY CONTENT -->
              <tr>
                <td style="padding: 32px 28px;">
                  
                  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; color: #0f172a;">
                    Dear <strong>${displayName}</strong>,
                  </p>
                  
                  <p style="font-size: 15px; line-height: 1.65; color: #334155; margin: 0 0 20px 0;">
                    We noticed that your seller profile setup on <strong>MEEEM</strong> is currently incomplete and some mandatory verification documents are still pending.
                  </p>

                  <!-- PROMO CALLOUT BANNER -->
                  <div style="background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border: 1px solid #86efac; border-radius: 12px; padding: 20px; margin: 20px 0 24px 0;">
                    <div style="display: flex; align-items: flex-start;">
                      <div>
                        <h3 style="margin: 0 0 8px 0; color: #166534; font-size: 17px; font-weight: 700;">
                          🚀 Unlock ${freeMonths} Months of 100% Free Full Access!
                        </h3>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #15803d;">
                          Submit your remaining documents today to activate your store and get <strong>${freeMonths} months of zero platform subscription fees</strong>, nationwide catalog visibility, verified partner status, and full access to our promotional tools!
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- PENDING DOCUMENTS & CHECKLIST BOX -->
                  <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                      <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                      <h4 style="margin: 0; color: #92400e; font-size: 15px; font-weight: 700;">
                        Pending Documents & Requirements
                      </h4>
                    </div>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #78350f;">
                      To get approved by our compliance team, please upload or complete the following items:
                    </p>
                    <ul style="margin: 0; padding-left: 18px;">
                      ${missingDocsHtml}
                    </ul>
                    ${missingStepsHtml}
                  </div>

                  <!-- BENEFITS LIST -->
                  <div style="margin: 28px 0 24px 0;">
                    <h4 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                      Why finish your onboarding on MEEEM?
                    </h4>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0; vertical-align: top; width: 24px; color: #4338ca; font-weight: bold;">✓</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #334155; line-height: 1.5;">
                          <strong>Zero Risk:</strong> Enjoy ${freeMonths} full months of free storefront access and feature-rich seller tools.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; vertical-align: top; width: 24px; color: #4338ca; font-weight: bold;">✓</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #334155; line-height: 1.5;">
                          <strong>Fast Customer Reach:</strong> Instantly showcase your offerings to thousands of ready-to-buy shoppers.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; vertical-align: top; width: 24px; color: #4338ca; font-weight: bold;">✓</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #334155; line-height: 1.5;">
                          <strong>Direct Payouts:</strong> Automated, transparent disbursements directly to your Bank or Mobile Money wallet.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; vertical-align: top; width: 24px; color: #4338ca; font-weight: bold;">✓</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #334155; line-height: 1.5;">
                          <strong>Dedicated Partner Support:</strong> Comprehensive assistance from our merchant success team.
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- CTA BUTTON -->
                  <div style="text-align: center; margin: 32px 0 28px 0;">
                    <a href="${onboardingUrl}" 
                       style="background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%); color: #ffffff; padding: 15px 36px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(67, 56, 202, 0.35);">
                      Complete Onboarding & Claim ${freeMonths} Months Free →
                    </a>
                  </div>

                  <p style="font-size: 13px; color: #64748b; text-align: center; margin: 0 0 24px 0; line-height: 1.5;">
                    Or paste this URL in your browser:<br/>
                    <a href="${onboardingUrl}" style="color: #4338ca; word-break: break-all; font-size: 12px;">${onboardingUrl}</a>
                  </p>

                  <!-- SUPPORT BOX -->
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 24px; font-size: 13px; color: #64748b; line-height: 1.6;">
                    <p style="margin: 0 0 6px 0;">
                      <strong>Need help uploading your documents?</strong>
                    </p>
                    <p style="margin: 0;">
                      Our vendor support team is here to assist you every step of the way. Simply reply to this email or contact us at <a href="mailto:support@meeemsl.com" style="color: #4338ca; text-decoration: none; font-weight: 600;">support@meeemsl.com</a>.
                    </p>
                  </div>

                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 28px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                  <p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b;">MEEEM E-commerce & Multi-Vendor Marketplace</p>
                  <p style="margin: 0 0 8px 0;">Empowering local businesses and merchants nationwide</p>
                  <p style="margin: 0;">
                    <a href="https://meeemsl.com" style="color: #64748b; text-decoration: none;">meeemsl.com</a> • <a href="mailto:support@meeemsl.com" style="color: #64748b; text-decoration: none;">support@meeemsl.com</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const text = `
Hi ${displayName},

We noticed that your seller onboarding on MEEEM (${typeLabel}) is still incomplete.

EXCLUSIVE OFFER: Complete your onboarding today to unlock ${freeMonths} MONTHS OF 100% FREE ACCESS with zero platform subscription fees!

Pending Documents & Requirements to upload:
${missingDocuments.length > 0 ? missingDocuments.map((d) => `- ${d}`).join("\n") : "- Business verification documents pending review"}
${missingSteps.length > 0 ? `\nPending Steps:\n${missingSteps.map((s) => `- ${s}`).join("\n")}` : ""}

Complete your onboarding now:
${onboardingUrl}

If you need any help, contact our support team at support@meeemsl.com.

Best regards,
MEEEM Vendor Support Team
https://meeemsl.com
  `.trim()

  return sendEmail({ to, subject, html, text })
}



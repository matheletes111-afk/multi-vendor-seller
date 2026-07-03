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

export async function sendPasswordResetOtpEmail({
  to,
  otp,
  name,
}: {
  to: string
  otp: string
  name?: string | null
}) {
  const subject = "Your password reset code"
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
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.subtotal.toFixed(2)}</td>
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
          <p style="margin: 5px 0;">Subtotal: <strong>$${subtotal.toFixed(2)}</strong></p>
          <p style="margin: 5px 0;">GST/Tax: <strong>$${tax.toFixed(2)}</strong></p>
          <p style="margin: 5px 0;">Shipping: <strong>$${shipping.toFixed(2)}</strong></p>
          <h3 style="margin: 10px 0; color: #007bff;">Total: $${totalAmount.toFixed(2)}</h3>
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
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.subtotal.toFixed(2)}</td>
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
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.subtotal.toFixed(2)}</td>
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
          <p style="margin: 5px 0;">Total Amount: <strong>$${totalAmount.toFixed(2)}</strong></p>
          <p style="margin: 5px 0; color: #28a745;">Commission Earned: <strong>$${commissionAmount.toFixed(2)}</strong></p>
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
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.subtotal.toFixed(2)}</td>
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
          <h3 style="margin: 10px 0; color: #007bff;">Total paid: $${totalAmount.toFixed(2)}</h3>
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
          <h3 style="margin: 15px 0 0 0; color: #007bff;">Total Price: $${totalPrice.toFixed(2)}</h3>
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
          <h3 style="margin: 15px 0 0 0; color: #007bff;">Total Revenue: $${totalPrice.toFixed(2)}</h3>
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


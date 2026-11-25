import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type RGB } from "pdf-lib"
import QRCode from "qrcode"
import type { InvoiceData } from "@/lib/invoice-types"

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const MARGIN_X = 36
const CONTENT_WIDTH = A4_WIDTH - MARGIN_X * 2

const COLOR_INK = rgb(0.06, 0.09, 0.16) // #0f172a
const COLOR_MUTED = rgb(0.39, 0.45, 0.55) // #64748b
const COLOR_LIGHT_MUTED = rgb(0.58, 0.64, 0.72) // #94a3b8
const COLOR_BORDER = rgb(0.89, 0.91, 0.94) // #e2e8f0
const COLOR_BG_SOFT = rgb(0.97, 0.98, 0.99) // #f8fafc
const COLOR_BLUE = rgb(0.11, 0.31, 0.85) // #1d4ed8
const COLOR_EMERALD = rgb(0.02, 0.47, 0.34) // #057857
const COLOR_EMERALD_BG = rgb(0.93, 0.99, 0.96)
const COLOR_AMBER = rgb(0.71, 0.33, 0.04) // #b45309
const COLOR_WHITE = rgb(1, 1, 1)

/**
 * Standard PDF fonts use WinAnsi encoding; replace unsupported emojis/symbols
 * so user-entered product/address text never throws during PDF serialization.
 */
function toWinAnsiSafe(input: string | null | undefined): string {
  if (!input) return ""
  return String(input)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/[\u2713\u2714]/g, "OK")
    // Strip characters outside WinAnsi basic/Latin-1 range (0x20-0xFF)
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function fmtMoney(amount: number): string {
  const num = Number.isFinite(amount) ? amount : 0
  return (
    "NLe " +
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d)
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const safe = toWinAnsiSafe(text)
  if (!safe) return [""]
  const words = safe.split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      // Hard-split extremely long single tokens (e.g. URLs / SKUs)
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = ""
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, fontSize) > maxWidth && chunk) {
            lines.push(chunk)
            chunk = ch
          } else {
            chunk += ch
          }
        }
        current = chunk
      } else {
        current = word
      }
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [""]
}

function drawRightText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB = COLOR_INK
) {
  const safe = toWinAnsiSafe(text)
  const w = font.widthOfTextAtSize(safe, size)
  page.drawText(safe, { x: rightX - w, y, size, font, color })
}

function drawQrCodeVector(page: PDFPage, qrText: string, x: number, y: number, totalSize: number) {
  const qr = QRCode.create(qrText, { errorCorrectionLevel: "M" })
  const count = qr.modules.size
  const data = qr.modules.data
  const quiet = 1
  const cellSize = totalSize / (count + quiet * 2)

  // White background box with thin border
  page.drawRectangle({
    x,
    y,
    width: totalSize,
    height: totalSize,
    color: COLOR_WHITE,
    borderColor: COLOR_BORDER,
    borderWidth: 0.75,
  })

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (data[row * count + col]) {
        const px = x + (col + quiet) * cellSize
        // PDF y-axis is bottom-up
        const py = y + totalSize - (row + 1 + quiet) * cellSize
        page.drawRectangle({
          x: px,
          y: py,
          width: cellSize + 0.08,
          height: cellSize + 0.08,
          color: COLOR_INK,
        })
      }
    }
  }
}

/**
 * Generates a vector A4 PDF containing one formatted tax invoice section per seller group.
 */
export async function generateOrderInvoicePdf(invoices: InvoiceData[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(
    invoices.length > 0 ? `MEEEM Invoice - #${invoices[0].orderNumber}` : "MEEEM Invoice"
  )
  pdfDoc.setProducer("MEEEM Multi-Vendor Platform")
  pdfDoc.setCreator("MEEEM Invoice Engine")

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold)

  for (const inv of invoices) {
    let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
    let y = A4_HEIGHT

    // Top Dark Accent Bar
    page.drawRectangle({
      x: 0,
      y: A4_HEIGHT - 10,
      width: A4_WIDTH,
      height: 10,
      color: COLOR_INK,
    })

    y = A4_HEIGHT - 42

    // Brand Badge + Title
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 4,
      width: 58,
      height: 18,
      color: COLOR_INK,
    })
    page.drawText("MEEEM", {
      x: MARGIN_X + 10,
      y: y + 1,
      size: 10,
      font: fontBold,
      color: COLOR_WHITE,
    })

    page.drawText("ORIGINAL FOR RECIPIENT", {
      x: MARGIN_X + 66,
      y: y + 2,
      size: 8,
      font: fontBold,
      color: COLOR_MUTED,
    })

    y -= 28
    page.drawText("TAX INVOICE", {
      x: MARGIN_X,
      y,
      size: 24,
      font: fontBold,
      color: COLOR_INK,
    })

    // QR Code in top-right corner
    const qrSize = 76
    const qrX = A4_WIDTH - MARGIN_X - qrSize
    const qrY = A4_HEIGHT - 104
    drawQrCodeVector(page, inv.qrVerifyUrl || `Order #${inv.orderNumber}`, qrX, qrY, qrSize)
    drawRightText(page, "Scan to Verify", A4_WIDTH - MARGIN_X - 9, qrY - 10, fontRegular, 7, COLOR_MUTED)

    // Metadata Row
    y -= 20
    page.drawText(`Invoice No: ${toWinAnsiSafe(inv.invoiceNumber)}`, {
      x: MARGIN_X,
      y,
      size: 9.5,
      font: fontBold,
      color: COLOR_INK,
    })
    page.drawText(`Order ID: #${toWinAnsiSafe(inv.orderNumber)}`, {
      x: MARGIN_X + 190,
      y,
      size: 9.5,
      font: fontMono,
      color: COLOR_INK,
    })

    y -= 14
    page.drawText(`Order Date: ${fmtDate(inv.date)}`, {
      x: MARGIN_X,
      y,
      size: 8.5,
      font: fontRegular,
      color: COLOR_MUTED,
    })
    page.drawText(`Order Status: ${toWinAnsiSafe(inv.orderStatus.replace(/_/g, " "))}`, {
      x: MARGIN_X + 190,
      y,
      size: 8.5,
      font: fontBold,
      color: COLOR_BLUE,
    })

    // Divider line under header
    y -= 16
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: A4_WIDTH - MARGIN_X, y },
      thickness: 1.4,
      color: COLOR_INK,
    })

    // Payment & Delivery Zone Info Bar
    y -= 26
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 4,
      width: CONTENT_WIDTH,
      height: 24,
      color: COLOR_BG_SOFT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    })

    const payText = `Payment: ${toWinAnsiSafe(inv.paymentMethodLabel || inv.paymentMethod || "COD")} (${toWinAnsiSafe(inv.paymentStatus || "PENDING")})`
    page.drawText(payText, {
      x: MARGIN_X + 8,
      y: y + 5,
      size: 8,
      font: fontBold,
      color: COLOR_INK,
    })

    const refText = inv.flotOrderId || inv.afriTxnId ? `Ref: ${inv.flotOrderId || inv.afriTxnId}` : ""
    const zoneText = `Delivery Region: ${toWinAnsiSafe(inv.deliveryZoneLabel)}`
    drawRightText(
      page,
      refText ? `${refText}  |  ${zoneText}` : zoneText,
      A4_WIDTH - MARGIN_X - 8,
      y + 5,
      fontBold,
      8,
      COLOR_EMERALD
    )

    // Address Cards (Sold By & Shipping To)
    y -= 14
    const colGap = 14
    const colWidth = (CONTENT_WIDTH - colGap) / 2
    const cardTextWidth = colWidth - 20

    type StyledPdfLine = { text: string; size: number; font: PDFFont; color: RGB }

    const appendWrapped = (
      target: StyledPdfLine[],
      text: string,
      size: number,
      font: PDFFont,
      color: RGB
    ) => {
      for (const wrappedLine of wrapText(text, font, size, cardTextWidth)) {
        target.push({ text: wrappedLine, size, font, color })
      }
    }

    const sellerLines: StyledPdfLine[] = []
    appendWrapped(sellerLines, inv.seller.storeName, 9.5, fontBold, COLOR_INK)
    if (inv.seller.businessName && inv.seller.businessName !== inv.seller.storeName) {
      appendWrapped(sellerLines, `Legal Name: ${inv.seller.businessName}`, 8.2, fontRegular, COLOR_MUTED)
    }
    appendWrapped(sellerLines, inv.seller.address, 8.2, fontRegular, COLOR_MUTED)
    appendWrapped(sellerLines, `Phone: ${inv.seller.phone}`, 8.2, fontBold, COLOR_MUTED)
    if (inv.seller.gstin) {
      appendWrapped(sellerLines, `GSTIN / TIN: ${inv.seller.gstin}`, 8.2, fontBold, COLOR_MUTED)
    }
    if (inv.seller.regNumber) {
      appendWrapped(sellerLines, `Reg No: ${inv.seller.regNumber}`, 8.2, fontBold, COLOR_MUTED)
    }

    const buyerLines: StyledPdfLine[] = []
    appendWrapped(buyerLines, inv.customerName, 9.5, fontBold, COLOR_INK)
    appendWrapped(buyerLines, inv.shippingAddress, 8.2, fontRegular, COLOR_MUTED)
    appendWrapped(buyerLines, `Phone: ${inv.customerPhone}`, 8.2, fontRegular, COLOR_MUTED)
    if (inv.customerEmail) {
      appendWrapped(buyerLines, `Email: ${inv.customerEmail}`, 8.2, fontRegular, COLOR_MUTED)
    }
    appendWrapped(buyerLines, `Zone / Region: ${inv.deliveryZoneLabel}`, 8.2, fontBold, COLOR_EMERALD)

    const maxLines = Math.max(sellerLines.length, buyerLines.length)
    const boxHeight = 28 + maxLines * 12 + 8
    const boxTop = y
    const boxBottom = boxTop - boxHeight

    // Left Card: Sold By
    page.drawRectangle({
      x: MARGIN_X,
      y: boxBottom,
      width: colWidth,
      height: boxHeight,
      color: COLOR_BG_SOFT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    })
    page.drawText("SOLD BY", {
      x: MARGIN_X + 10,
      y: boxTop - 15,
      size: 7.5,
      font: fontBold,
      color: COLOR_LIGHT_MUTED,
    })
    sellerLines.forEach((line, idx) => {
      page.drawText(toWinAnsiSafe(line.text), {
        x: MARGIN_X + 10,
        y: boxTop - 30 - idx * 12,
        size: line.size,
        font: line.font,
        color: line.color,
      })
    })

    // Right Card: Shipping To
    const rightBoxX = MARGIN_X + colWidth + colGap
    page.drawRectangle({
      x: rightBoxX,
      y: boxBottom,
      width: colWidth,
      height: boxHeight,
      color: COLOR_BG_SOFT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    })
    page.drawText("SHIPPING / BILLING TO", {
      x: rightBoxX + 10,
      y: boxTop - 15,
      size: 7.5,
      font: fontBold,
      color: COLOR_LIGHT_MUTED,
    })
    buyerLines.forEach((line, idx) => {
      page.drawText(toWinAnsiSafe(line.text), {
        x: rightBoxX + 10,
        y: boxTop - 30 - idx * 12,
        size: line.size,
        font: line.font,
        color: line.color,
      })
    })

    y = boxBottom - 18

    // Table Header Helper
    const colNoX = MARGIN_X + 8
    const colDescX = MARGIN_X + 28
    const colDescMaxW = 225
    const colQtyRight = MARGIN_X + 292
    const colPriceRight = MARGIN_X + 368
    const colGstRight = MARGIN_X + 438
    const colTotalRight = A4_WIDTH - MARGIN_X - 8

    const drawTableHeader = (currPage: PDFPage, topY: number) => {
      currPage.drawRectangle({
        x: MARGIN_X,
        y: topY - 22,
        width: CONTENT_WIDTH,
        height: 22,
        color: COLOR_INK,
      })
      const textY = topY - 14
      currPage.drawText("#", { x: colNoX, y: textY, size: 7.5, font: fontBold, color: COLOR_WHITE })
      currPage.drawText("ITEM DESCRIPTION", { x: colDescX, y: textY, size: 7.5, font: fontBold, color: COLOR_WHITE })
      drawRightText(currPage, "QTY", colQtyRight, textY, fontBold, 7.5, COLOR_WHITE)
      drawRightText(currPage, "UNIT PRICE", colPriceRight, textY, fontBold, 7.5, COLOR_WHITE)
      drawRightText(currPage, "GST", colGstRight, textY, fontBold, 7.5, COLOR_WHITE)
      drawRightText(currPage, "NET AMOUNT", colTotalRight, textY, fontBold, 7.5, COLOR_WHITE)
      return topY - 22
    }

    y = drawTableHeader(page, y)

    inv.items.forEach((item, idx) => {
      const descTitle = item.isExchangeReplacement
        ? `${item.productName} [Exchange Replacement]`
        : item.productName
      const titleLines = wrapText(descTitle, fontBold, 8.5, colDescMaxW)
      const subParts: string[] = []
      if (item.sku) subParts.push(`SKU: ${item.sku}`)
      if (item.serviceSlotStartTime && item.serviceSlotEndTime) {
        const s = new Date(item.serviceSlotStartTime)
        const e = new Date(item.serviceSlotEndTime)
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          subParts.push(`Slot: ${s.toISOString().slice(11, 16)}-${e.toISOString().slice(11, 16)} UTC`)
        }
      }
      const subLines = subParts.length > 0 ? wrapText(subParts.join(" | "), fontRegular, 7.5, colDescMaxW) : []
      const rowHeight = Math.max(24, 10 + titleLines.length * 10.5 + subLines.length * 9.5 + 4)

      // Page break if needed
      if (y - rowHeight < 110) {
        page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
        page.drawRectangle({ x: 0, y: A4_HEIGHT - 10, width: A4_WIDTH, height: 10, color: COLOR_INK })
        page.drawText(`Invoice ${toWinAnsiSafe(inv.invoiceNumber)} (Continued)`, {
          x: MARGIN_X,
          y: A4_HEIGHT - 32,
          size: 9,
          font: fontBold,
          color: COLOR_MUTED,
        })
        y = drawTableHeader(page, A4_HEIGHT - 48)
      }

      if (idx % 2 === 1) {
        page.drawRectangle({
          x: MARGIN_X,
          y: y - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: COLOR_BG_SOFT,
        })
      }

      const firstLineY = y - 13
      page.drawText(String(idx + 1), {
        x: colNoX,
        y: firstLineY,
        size: 8.5,
        font: fontRegular,
        color: COLOR_MUTED,
      })

      titleLines.forEach((line, lIdx) => {
        page.drawText(toWinAnsiSafe(line), {
          x: colDescX,
          y: firstLineY - lIdx * 10.5,
          size: 8.5,
          font: fontBold,
          color: COLOR_INK,
        })
      })
      subLines.forEach((line, lIdx) => {
        page.drawText(toWinAnsiSafe(line), {
          x: colDescX,
          y: firstLineY - titleLines.length * 10.5 - lIdx * 9.5,
          size: 7.5,
          font: fontRegular,
          color: COLOR_MUTED,
        })
      })

      drawRightText(page, String(item.quantity), colQtyRight, firstLineY, fontRegular, 8.5, COLOR_INK)
      drawRightText(page, fmtMoney(item.price), colPriceRight, firstLineY, fontRegular, 8.5, COLOR_INK)
      drawRightText(
        page,
        item.gstAmount > 0 ? fmtMoney(item.gstAmount) : "NLe 0.00",
        colGstRight,
        firstLineY,
        fontRegular,
        8.5,
        item.gstAmount > 0 ? COLOR_EMERALD : COLOR_MUTED
      )
      drawRightText(page, fmtMoney(item.total), colTotalRight, firstLineY, fontBold, 8.5, COLOR_INK)

      y -= rowHeight
      page.drawLine({
        start: { x: MARGIN_X, y },
        end: { x: A4_WIDTH - MARGIN_X, y },
        thickness: 0.5,
        color: COLOR_BORDER,
      })
    })

    // Left Side: Delivery Zone & Verification Notes | Right Side: Totals Summary Box
    const summaryWidth = 240
    const summaryX = A4_WIDTH - MARGIN_X - summaryWidth
    const summaryRows: Array<{ label: string; value: string; color?: RGB; bold?: boolean }> = [
      { label: "Item Subtotal (Excl. Tax)", value: fmtMoney(inv.subtotal) },
      { label: "Total GST", value: `+${fmtMoney(inv.gstTotal)}`, color: COLOR_EMERALD },
      { label: "Item Gross (Tax-Incl.)", value: fmtMoney(inv.itemGrossTotal), bold: true },
    ]

    if (!inv.isServiceOnly || inv.shippingCharge > 0) {
      summaryRows.push({
        label: `Delivery Charge`,
        value: inv.shippingCharge <= 0 ? "FREE" : `+${fmtMoney(inv.shippingCharge)}`,
        color: inv.shippingCharge <= 0 ? COLOR_EMERALD : COLOR_AMBER,
        bold: true,
      })
    }

    if (inv.couponDiscount && inv.couponDiscount > 0) {
      summaryRows.push({
        label: `Coupon Discount${inv.couponCode ? ` (${inv.couponCode})` : ""}`,
        value: `-${fmtMoney(inv.couponDiscount)}`,
        color: COLOR_EMERALD,
      })
    }

    if (inv.exchangeTopUpAmount && inv.exchangeTopUpAmount > 0) {
      summaryRows.push({
        label: "Exchange Top-up",
        value: `+${fmtMoney(inv.exchangeTopUpAmount)}`,
        color: COLOR_AMBER,
      })
    }

    const leftNoteW = CONTENT_WIDTH - summaryWidth - 16
    const leftMetaRaw = [
      `Delivery Region / Zone: ${inv.deliveryZoneLabel}`,
      `Delivery Fee: ${inv.isServiceOnly && inv.shippingCharge <= 0 ? "N/A (Service)" : inv.shippingCharge <= 0 ? "FREE" : fmtMoney(inv.shippingCharge)}`,
      `Payment Method: ${inv.paymentMethodLabel || inv.paymentMethod || "COD"}`,
      `Payment Status: ${inv.paymentStatus || "PENDING"}`,
      ...(inv.paidAt ? [`Paid At: ${fmtDate(inv.paidAt)}`] : []),
      ...(inv.flotOrderId ? [`Float Ref: ${inv.flotOrderId}`] : []),
      ...(inv.afriTxnId ? [`AfriMoney Ref: ${inv.afriTxnId}`] : []),
    ]
    const leftMetaRendered: Array<{ text: string; bold: boolean }> = []
    leftMetaRaw.forEach((rawLine, mIdx) => {
      const wrapped = wrapText(rawLine, mIdx === 0 ? fontBold : fontRegular, 8, leftNoteW - 20)
      wrapped.forEach((wl) => {
        leftMetaRendered.push({ text: wl, bold: mIdx === 0 })
      })
    })

    const rightBoxHeight = 20 + summaryRows.length * 16 + 34
    const leftBoxHeight = 36 + leftMetaRendered.length * 12 + 10
    const summaryBoxHeight = Math.max(rightBoxHeight, leftBoxHeight)
    const footerReservedTop = 128

    // Ensure enough vertical space for both summary boxes above the fixed footer
    if (y - 18 - summaryBoxHeight < footerReservedTop) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
      page.drawRectangle({ x: 0, y: A4_HEIGHT - 10, width: A4_WIDTH, height: 10, color: COLOR_INK })
      y = A4_HEIGHT - 44
    } else {
      y -= 18
    }

    const summaryBottom = y - summaryBoxHeight

    // Draw Left Delivery & Verification Box
    page.drawRectangle({
      x: MARGIN_X,
      y: summaryBottom,
      width: leftNoteW,
      height: summaryBoxHeight,
      color: COLOR_EMERALD_BG,
      borderColor: rgb(0.65, 0.95, 0.82),
      borderWidth: 0.75,
    })
    page.drawText("DELIVERY & VERIFICATION DETAILS", {
      x: MARGIN_X + 10,
      y: y - 16,
      size: 7.5,
      font: fontBold,
      color: COLOR_EMERALD,
    })
    leftMetaRendered.forEach((line, lIdx) => {
      page.drawText(line.text, {
        x: MARGIN_X + 10,
        y: y - 32 - lIdx * 12,
        size: 8,
        font: line.bold ? fontBold : fontRegular,
        color: COLOR_INK,
      })
    })

    // Draw Right Summary Box
    page.drawRectangle({
      x: summaryX,
      y: summaryBottom,
      width: summaryWidth,
      height: summaryBoxHeight,
      color: COLOR_BG_SOFT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    })

    let sy = y - 18
    for (const row of summaryRows) {
      page.drawText(toWinAnsiSafe(row.label), {
        x: summaryX + 12,
        y: sy,
        size: 8.5,
        font: row.bold ? fontBold : fontRegular,
        color: COLOR_MUTED,
      })
      drawRightText(
        page,
        row.value,
        summaryX + summaryWidth - 12,
        sy,
        row.bold ? fontBold : fontRegular,
        8.5,
        row.color ?? COLOR_INK
      )
      sy -= 16
    }

    // Dashed/Solid separator before Grand Total
    page.drawLine({
      start: { x: summaryX + 12, y: sy + 6 },
      end: { x: summaryX + summaryWidth - 12, y: sy + 6 },
      thickness: 1,
      color: COLOR_INK,
    })

    sy -= 12
    page.drawText("GRAND TOTAL", {
      x: summaryX + 12,
      y: sy,
      size: 10,
      font: fontBold,
      color: COLOR_INK,
    })
    drawRightText(
      page,
      fmtMoney(inv.grandTotal),
      summaryX + summaryWidth - 12,
      sy,
      fontBold,
      12,
      COLOR_INK
    )

    // Footer Section
    const footerY = 92
    page.drawLine({
      start: { x: MARGIN_X, y: footerY + 26 },
      end: { x: A4_WIDTH - MARGIN_X, y: footerY + 26 },
      thickness: 0.75,
      color: COLOR_BORDER,
    })

    page.drawText("DECLARATION", {
      x: MARGIN_X,
      y: footerY + 12,
      size: 7.5,
      font: fontBold,
      color: COLOR_INK,
    })
    page.drawText(
      "We declare that this invoice shows the actual price of the goods/services described and all particulars are true.",
      {
        x: MARGIN_X,
        y: footerY,
        size: 7.2,
        font: fontRegular,
        color: COLOR_MUTED,
      }
    )
    page.drawText(
      "This is a computer-generated invoice verified via QR code and does not require a physical signature.",
      {
        x: MARGIN_X,
        y: footerY - 10,
        size: 7.2,
        font: fontRegular,
        color: COLOR_MUTED,
      }
    )

    drawRightText(page, "Authorized Signatory", A4_WIDTH - MARGIN_X, footerY + 2, fontBold, 7.5, COLOR_INK)
    drawRightText(page, `For ${inv.seller.storeName}`, A4_WIDTH - MARGIN_X, footerY - 8, fontRegular, 7, COLOR_MUTED)

    page.drawLine({
      start: { x: MARGIN_X, y: 46 },
      end: { x: A4_WIDTH - MARGIN_X, y: 46 },
      thickness: 0.5,
      color: COLOR_BORDER,
    })
    page.drawText("© 2026 MEEEM PLATFORM. All rights reserved.", {
      x: MARGIN_X,
      y: 32,
      size: 7.5,
      font: fontRegular,
      color: COLOR_MUTED,
    })
    drawRightText(
      page,
      `REF: ${inv.invoiceNumber} | Scan QR to verify authenticity`,
      A4_WIDTH - MARGIN_X,
      32,
      fontMono,
      7,
      COLOR_LIGHT_MUTED
    )
  }

  return pdfDoc.save()
}

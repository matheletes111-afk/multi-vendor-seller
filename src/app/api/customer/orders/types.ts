/**
 * Customer orders API types for app/api/customer/orders.
 */

export type OrderDetailItemApi = {
  id: string
  sellerId: string | null
  sellerStoreName: string | null
  itemStatus: string
  productId: string | null
  serviceId: string | null
  productNameSnapshot: string | null
  serviceNameSnapshot: string | null
  quantity: number
  price: number
  subtotal: number
  hasGst: boolean
  gstAmount: number
  subtotalInclGst: number | null
  imageUrl: string | null
  /** Service slot (for service orders). ISO date-time strings. */
  serviceSlotStartTime: string | null
  serviceSlotEndTime: string | null
  review: {
    id: string
    rating: number
    comment: string | null
    images: string[]
    isVerified: boolean
  } | null
  canReview: boolean
  shippingAmount: number
  commissionAmount: number
  commissionRateSnapshot: number
  returnAvailable: boolean
  /** When true (per variant), customer may request exchange instead of refund only. */
  replacementAllowed: boolean
  returnPolicyType: "RETURNABLE" | "NON_RETURNABLE" | null
  returnPolicyDays: number | null
  returnResolutionType: "REFUND" | "EXCHANGE" | null
  replacementOrderItemId: string | null
  /** Set on the new line created for an exchange; links back to the original item. */
  exchangeSourceOrderItemId: string | null
  exchangeTopUpAmount: number
  exchangeTopUpStatus: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | null
  exchangeRefundDifferenceAmount: number
  exchangeRefundDifferenceStatus: "NOT_REQUESTED" | "PENDING" | "COMPLETED" | null
  /** Customer's return reason (after a return is requested). */
  returnReason: string | null
  /** Uploaded photo URLs for the return request. */
  returnImages: string[]
  returnRequestStatus: "REQUESTED" | "ACCEPTED" | "REJECTED" | null
  pickupStatus: "NOT_REQUESTED" | "PENDING" | "COMPLETED" | null
  refundStatus: "NOT_REQUESTED" | "PENDING" | "COMPLETED" | null
  deliveryProofImage: string | null
  statusHistory: {
    status: string
    location: string | null
    note: string | null
    createdAt: string
  }[]
}

export type CustomerOrderSellerGroupApi = {
  sellerId: string | null
  sellerStoreName: string | null
  summary: {
    subtotal: number
    tax: number
    shipping: number
    commission: number
    total: number
  }
  itemStatuses: Record<string, number>
  derivedStatus: string
  itemCount: number
}

export type OrderDetailApi = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  subtotal: number
  tax: number
  shipping: number
  paymentMethod: string | null
  paymentStatus: string
  shippingFullName: string | null
  shippingPhone: string | null
  shippingAddressLine1: string | null
  shippingAddressLine2: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingPostalCode: string | null
  shippingCountry: string | null
  createdAt: string
  sellerStoreName: string | null
  sellerGroups: CustomerOrderSellerGroupApi[]
  items: OrderDetailItemApi[]
}

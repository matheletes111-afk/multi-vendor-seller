================================================================================
MEEEM DELIVERY RIDER MOBILE APP — DISPATCH, ACCEPTANCE, LIFECYCLE & CANCELLATION API
================================================================================
Title:    Delivery Rider — Dispatch Offer, Status Progression, Handover OTP & Trip Cancellation
Version:  1.0.0 (Part 8 — Rider Mobile App Reference)
Audience: Mobile Developers (Flutter / Kotlin / Swift / React Native)
Base URL: https://www.meeemsl.com/mobileapi/rider
WebSocket Server: https://socket.meeemsl.com (Port 443 SSL / WSS — do NOT add :3001)
Auth:     Authorization: Bearer <riderAccessToken>

--------------------------------------------------------------------------------
TABLE OF CONTENTS
--------------------------------------------------------------------------------
1. EXECUTIVE SUMMARY & RIDER DELIVERY LIFECYCLE
2. RIDER DISPATCH OFFER & ACCEPT/REJECT APIS
   - 2.1 Accept Delivery Offer (`POST /mobileapi/rider/orders/:id/accept`)
   - 2.2 Reject Delivery Offer (`POST /mobileapi/rider/orders/:id/reject`)
3. ORDER STATUS PROGRESSION ENDPOINT (`POST /mobileapi/rider/orders/:id/status`)
   - 3.1 Transition to AT_PICKUP (Arrived at Seller Store)
   - 3.2 Transition to PICKED_UP (Collected Items from Store)
   - 3.3 Transition to OUT_FOR_DELIVERY (On the Way to Customer)
   - 3.4 Transition to DELIVERED (With Customer Handover OTP & Photo Proof)
4. EMERGENCY TRIP CANCELLATION BY RIDER (`CANCELLED_BY_RIDER`)
   - 4.1 Allowed Scenarios & Reasons
   - 4.2 Cancellation Request & Response
   - 4.3 Rider App UI Guidelines (Cancel Button & Dialog)
5. REAL-TIME GPS TELEMETRY STREAMING (Socket.IO)
6. COMPLETE SAMPLE FLUTTER / DART RIDER SERVICE

================================================================================
1. EXECUTIVE SUMMARY & RIDER DELIVERY LIFECYCLE
================================================================================
When an order is dispatched to a delivery rider, the trip progresses through
the following strict state machine:

  [OFFERED]  (60-second acceptance countdown popup)
      │
      ├──> (Reject or 60s Timeout) ──> Cascades to next nearest rider
      │
      └──> (Rider Taps Accept)
            │
            ▼
        [ACCEPTED]  (Rider navigates to Seller Store)
            │
            ▼
       [AT_PICKUP]  (Rider arrives at Seller Store)
            │
            ▼
       [PICKED_UP]  (Rider receives package from Seller; Order -> SHIPPED)
            │
            ▼
   [OUT_FOR_DELIVERY] (Rider navigates to Customer; Customer receives 6-digit OTP)
            │
            ▼
       [DELIVERED]  (Rider inputs Customer's 6-digit OTP + uploads parcel photo)

* IMPORTANT CANCELLATION RULES:
  - While ACCEPTED or AT_PICKUP (before items are picked up):
    If the rider encounters a vehicle breakdown, personal emergency, or road
    issue, the rider can CANCEL the trip using CANCELLED_BY_RIDER.
  - Once PICKED_UP:
    Items are in the rider's physical possession, so one-click cancellation
    is disabled for merchandise security.

================================================================================
2. RIDER DISPATCH OFFER & ACCEPT/REJECT APIS
================================================================================

--------------------------------------------------------------------------------
2.1 Accept Delivery Offer
--------------------------------------------------------------------------------
Endpoint:  POST /mobileapi/rider/orders/:id/accept
Headers:
  Authorization: Bearer <riderAccessToken>
  Content-Type: application/json

When a rider receives a Firebase Push Notification or Socket event for a new
delivery opportunity, they have 60 seconds to accept.

Request: {}  (Empty body or optional { "deviceToken": "..." })

Success Response (200 OK):
{
  "success": true,
  "message": "Delivery offer accepted successfully",
  "data": {
    "id": "cuid_assignment_123",
    "orderId": "order_xyz",
    "status": "ACCEPTED",
    "acceptedAt": "2026-09-10T11:00:00.000Z"
  }
}

Error Response (400 Bad Request) - Already expired or accepted by someone else:
{
  "success": false,
  "error": "Offer has expired or is no longer available"
}

--------------------------------------------------------------------------------
2.2 Reject Delivery Offer
--------------------------------------------------------------------------------
Endpoint:  POST /mobileapi/rider/orders/:id/reject
Headers:
  Authorization: Bearer <riderAccessToken>
  Content-Type: application/json

Request:
{
  "reason": "Too far from current location"
}

Success Response (200 OK):
{
  "success": true,
  "message": "Delivery offer rejected"
}
*Note: Rejecting an offer immediately triggers the backend waterfall to notify
the next nearest rider without waiting for the 60s timeout.

================================================================================
3. ORDER STATUS PROGRESSION ENDPOINT
================================================================================
Endpoint:  POST /mobileapi/rider/orders/:id/status
Headers:
  Authorization: Bearer <riderAccessToken>
  Content-Type: application/json

This single endpoint is used by the rider to advance the delivery through each milestone.

--------------------------------------------------------------------------------
3.1 Transition to AT_PICKUP (Rider Arrived at Seller Store)
--------------------------------------------------------------------------------
Request:
{
  "status": "AT_PICKUP"
}

Success Response (200 OK):
{
  "success": true,
  "message": "Delivery status updated to AT_PICKUP"
}

--------------------------------------------------------------------------------
3.2 Transition to PICKED_UP (Rider Collected Parcel from Store)
--------------------------------------------------------------------------------
Request:
{
  "status": "PICKED_UP"
}

Success Response (200 OK):
{
  "success": true,
  "message": "Delivery status updated to PICKED_UP"
}
*Backend automatically updates the store's OrderItem status to "SHIPPED".

--------------------------------------------------------------------------------
3.3 Transition to OUT_FOR_DELIVERY (Rider En Route to Customer)
--------------------------------------------------------------------------------
Request:
{
  "status": "OUT_FOR_DELIVERY"
}

Success Response (200 OK):
{
  "success": true,
  "message": "Delivery status updated to OUT_FOR_DELIVERY"
}
*Backend generates the unique 6-digit Handover OTP and sends it to the customer
via Email, SMS, and Customer App.

--------------------------------------------------------------------------------
3.4 Transition to DELIVERED (With Handover OTP & Visual Photo Proof)
--------------------------------------------------------------------------------
At customer doorstep, rider collects the 6-digit OTP from customer and takes
a photo of the handed-over parcel.

Request:
{
  "status": "DELIVERED",
  "otp": "582910",
  "proofImage": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."  // or public image URL
}

Success Response (200 OK):
{
  "success": true,
  "message": "Delivery status updated to DELIVERED",
  "data": {
    "status": "DELIVERED",
    "deliveredAt": "2026-09-10T11:45:00.000Z"
  }
}

Error Response (400 Bad Request) - Incorrect OTP:
{
  "success": false,
  "error": "Invalid Delivery OTP provided by customer"
}

================================================================================
4. EMERGENCY TRIP CANCELLATION BY RIDER (CANCELLED_BY_RIDER)
================================================================================

--------------------------------------------------------------------------------
4.1 Allowed Scenarios & Reasons
--------------------------------------------------------------------------------
If an assigned rider is on the way to the seller store (status == ACCEPTED or AT_PICKUP)
and cannot complete the pickup due to:
- Vehicle breakdown (flat tire, mechanical failure)
- Personal emergency
- Store closed / merchant unreachable
- Severe weather / road impassable

The rider can cancel the trip directly from the Rider App.

--------------------------------------------------------------------------------
4.2 Cancellation Request
--------------------------------------------------------------------------------
Endpoint:  POST /mobileapi/rider/orders/:id/status
Headers:
  Authorization: Bearer <riderAccessToken>
  Content-Type: application/json

Request:
{
  "status": "CANCELLED_BY_RIDER",
  "cancellationReason": "Vehicle breakdown"
}

Success Response (200 OK):
{
  "success": true,
  "message": "Delivery status updated to CANCELLED_BY_RIDER",
  "data": { ... }
}

What Happens on Backend:
1. Assignment status is marked as CANCELLED_BY_RIDER.
2. The rider is freed immediately and can receive other trips.
3. The seller is notified of the cancellation.
4. The backend waterfall engine immediately re-dispatches the parcel to the
   next closest available rider.

--------------------------------------------------------------------------------
4.3 Rider App UI Guidelines
--------------------------------------------------------------------------------
1. In the Active Order screen, display a red outline button: [Cancel Delivery].
2. When tapped, open a modal with standard reasons:
   - "Vehicle breakdown"
   - "Personal emergency"
   - "Store was closed"
   - "Severe weather / impassable road"
3. Upon confirmation, submit `CANCELLED_BY_RIDER`.
4. Pop the order screen and return the rider to the main Dashboard / Orders tab.

================================================================================
5. REAL-TIME GPS TELEMETRY STREAMING (Socket.IO)
================================================================================
WebSocket Server: `https://socket.meeemsl.com` (Port 443 SSL / WSS)

While a delivery is active (ACCEPTED through OUT_FOR_DELIVERY), the rider app
must stream GPS coordinates every 3-5 seconds:

```dart
// Connect to WebSocket
final socket = IO.io('https://socket.meeemsl.com', <String, dynamic>{
  'transports': ['websocket', 'polling'],
  'autoConnect': true,
});

// Join the order room
socket.emit('join_order', { 'orderId': orderId });

// Stream location update
void sendLocationUpdate(double lat, double lng, double heading, double speed) {
  socket.emit('rider_location_update', {
    'orderId': orderId,
    'riderId': riderId,
    'latitude': lat,
    'longitude': lng,
    'heading': heading,
    'speed': speed,
  });
}
```

================================================================================
6. COMPLETE SAMPLE FLUTTER / DART RIDER SERVICE
================================================================================

import 'dart:convert';
import 'package:http/http.dart' as http;

class RiderDeliveryService {
  static const String baseUrl = 'https://www.meeemsl.com/mobileapi/rider';

  // 1. Accept Delivery Offer (Within 60s countdown)
  static Future<Map<String, dynamic>> acceptOffer({
    required String orderId,
    required String token,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/orders/$orderId/accept'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({}),
    );
    return jsonDecode(res.body);
  }

  // 2. Reject Delivery Offer
  static Future<Map<String, dynamic>> rejectOffer({
    required String orderId,
    String? reason,
    required String token,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/orders/$orderId/reject'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        if (reason != null) 'reason': reason,
      }),
    );
    return jsonDecode(res.body);
  }

  // 3. Update Status (AT_PICKUP, PICKED_UP, OUT_FOR_DELIVERY)
  static Future<Map<String, dynamic>> updateStatus({
    required String orderId,
    required String status,
    required String token,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/orders/$orderId/status'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'status': status}),
    );
    return jsonDecode(res.body);
  }

  // 4. Complete Delivery (Verify Customer OTP + Upload Photo Proof)
  static Future<Map<String, dynamic>> completeDelivery({
    required String orderId,
    required String otp,
    required String proofImageBase64,
    required String token,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/orders/$orderId/status'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'status': 'DELIVERED',
        'otp': otp,
        'proofImage': proofImageBase64,
      }),
    );
    return jsonDecode(res.body);
  }

  // 5. Emergency Cancel Delivery Trip (Vehicle breakdown, emergency, etc.)
  static Future<Map<String, dynamic>> cancelTrip({
    required String orderId,
    required String cancellationReason,
    required String token,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/orders/$orderId/status'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'status': 'CANCELLED_BY_RIDER',
        'cancellationReason': cancellationReason,
      }),
    );
    return jsonDecode(res.body);
  }
}

================================================================================
END OF DOCUMENTATION
================================================================================

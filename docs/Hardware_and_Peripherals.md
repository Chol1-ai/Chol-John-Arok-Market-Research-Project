# Hardware, Peripherals & Operational Resilience Specification

**Target Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA)<br>
**Location:** Kampala, Uganda<br>
**Target Environment:** Antigravity IDE + Opencode CLI Repository Scaffold<br>
**Related Specifications:** `Foundational_Concept.md` · `Design_System.md` · `User_Flow.md` · `User_Profiles_Personas.md` · `Delivery_Zones_and_Dispatch.md` · `Tech_Stack.md` · `Payment_Integration.md` · `Seed_Data_and_Testing.md` · `Repo_Scaffold_and_Config.md` · `Demo_Script_and_Closing_Strategy.md` · `Daily_Audit_Digest.md` · `Deployment_Runbook.md` · `Service_Contract_and_Invoice_Template.md` · `build_strategy/Build_Strategy_and_Phases.md`

---

## 1. Peripheral Architecture: ESC/POS Thermal Printing

To eliminate order mix-ups between walk-ins, phone deliveries, and students rushing to lectures, every `TAKEAWAY_PICKUP` or `PHONE_DELIVERY` order bumped to `READY` at the Expo Station automatically fires an ESC/POS packaging-chit print job over the local network (LAN) to a thermal printer at the packing counter. `DINE_IN` food is plated and served at the table, so it does not produce a bag label.

```
+-----------------------------------+
|     EXPO SCREEN (Pass Station)    |
|     Cook taps "BUMP TO READY"     |
+-----------------+-----------------+
                  |
                  v (Local TCP/IP raw socket - Port 9100)
+-----------------------------------+
|       THERMAL PRINTER (80mm)      |
|   Xprinter XP-80C (Ethernet/LAN)  |
+-----------------+-----------------+
                  |
                  v
+-----------------------------------+
|      ADHESIVE PACKAGING CHIT      |
|  - High-visibility Digital Token  |
|  - Customer Name & Channel        |
|  - Delivery Zone / Room / Phone   |
|  - Packaged Item Checklist        |
+-----------------------------------+
```

### 1.1 Thermal Chit Raw Template (ESC/POS Byte Commands)

```typescript
// escpos-generator.ts: Raw ESC/POS template for the Expo bag / delivery chit
//
// SECURITY: customer notes are printed to a raw printer. Strip ESC, GS, and
// all control bytes before interpolation so a note cannot inject printer
// commands. Cap every free-text field at the UI limit.
function sanitizeChitText(value: string, maxLength = 160): string {
  return value
    .replace(/[\x00-\x1F\x7F]/g, ' ') // ESC/POS + ASCII control bytes
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function generateExpoBagLabel(order: {
  digitalToken: string;
  customerName: string;
  channel: string;
  items: Array<{ name: string; quantity: number; notes?: string }>;
  timestamp: string;
  // Delivery-only fields. Omit for dine-in and takeaway pickup.
  destinationZone?: string;
  deliveryNote?: string;
  customerPhone?: string;
}): Buffer {
  const ESC = '\x1B';
  const GS = '\x1D';

  let commands = '';

  // Initialize Printer
  commands += `${ESC}@`;

  // Center alignment + Double Width/Double Height for Token
  commands += `${ESC}a\x01`; // Center align
  commands += `${ESC}!\x38`; // Double height + double width + bold
  commands += `\n${sanitizeChitText(order.digitalToken, 20)}\n`;

  // Normal text size + Bold
  commands += `${ESC}!\x08`;
  commands += `--------------------------------\n`;
  commands += `${sanitizeChitText(order.channel, 20)} | ${sanitizeChitText(order.customerName, 80)}\n`;
  commands += `${sanitizeChitText(order.timestamp, 40)}\n`;
  commands += `--------------------------------\n`;

  // Delivery block: destination + room + rider-callable phone.
  // This is the ONLY printed surface that carries the phone number.
  // The KDS itself must never display it.
  if (order.channel === 'PHONE_DELIVERY') {
    commands += `${ESC}!\x08`; // bold on
    commands += `DELIVERY\n`;
    commands += `DESTINATION: ${sanitizeChitText(order.destinationZone ?? '', 100)}\n`;
    commands += `ROOM/NOTE: ${sanitizeChitText(order.deliveryNote ?? '', 160)}\n`;
    commands += `PHONE: ${sanitizeChitText(order.customerPhone ?? '', 20)}\n`;
    commands += `--------------------------------\n`;
    commands += `${ESC}!\x00`; // bold off
  }

  // Left align for item list
  commands += `${ESC}a\x00`; // Left align
  commands += `${ESC}!\x00`; // Normal font

  order.items.forEach(item => {
    commands += `[ ] ${item.quantity}x ${sanitizeChitText(item.name, 100)}\n`;
    if (item.notes) {
      commands += `    * NOTE: ${sanitizeChitText(item.notes, 160)}\n`;
    }
  });

  commands += `--------------------------------\n`;
  commands += `${ESC}a\x01`; // Center align
  commands += `PACKED BY: ________ CHECKED: [X]\n\n\n`;

  // Cut Paper (GS V 66 0)
  commands += `${GS}V\x42\x00`;

  return Buffer.from(commands, 'binary');
}
```

### 1.2 Delivery Chit Layout (80mm)

```text
+------------------------------------------------+
|                  TOKEN-042                     |
|                  PHONE-DELIVERY                |
+------------------------------------------------+
| CUSTOMER: DR. OKELLO                           |
| DESTINATION: YMCA MAIN CAMPUS                  |
| ROOM/NOTE: BLOCK C, ROOM 204                   |
|   CALL AT SECURITY GATE                        |
| PHONE: 0701 234 567                            |
+------------------------------------------------+
| [ ] 1x TRADITIONAL BEEF LUWOMBO                |
| [ ] 1x STEAMED MATOOKE                         |
+------------------------------------------------+
| PACKED BY: ________   CHECKED: [ ]             |
+------------------------------------------------+
```

**Rules**

- Print the delivery block only when `channel === 'PHONE_DELIVERY'`; `TAKEAWAY_PICKUP` prints a compact bag label with the token and item checklist. `DINE_IN` does not print a packaging chit.
- The phone number is printed in a bold, readable size so the rider can dial without opening the FOH screen. It is never printed on the KDS.
- The chit is printed when a `TAKEAWAY_PICKUP` or `PHONE_DELIVERY` order reaches `READY`, so the food is packed and the rider can leave immediately.
- If the customer did not share a GPS pin, the chit is still complete: zone + room note + phone are sufficient. Do not print “no location” warnings.
- Do not print the full Google Maps URL in Phase 1; it wraps badly on 80mm paper. The FOH dispatch screen carries the static link.
- Reprints are initiated only from the FOH dispatch screen and must be audit-logged. Do not expose a reprint button on the KDS.
- A delivery chit contains personal data. Hand it to the rider with the bag; do not leave it on the packing counter.

### 1.3 Printer Safety & ESC/POS Injection

- Customer-controlled text (`customerName`, `deliveryNote`, item names, item notes) must pass through `sanitizeChitText` before interpolation. The helper strips `ESC` (`0x1B`), `GS` (`0x1D`), and all control bytes, collapses whitespace, and caps length.
- Never build a raw command string from an unsanitized database value. A note such as `hello\x1B@` must print as text, not reset the printer.
- The printer is on the local LAN. Bind it to the store network only; do not expose port `9100` to the internet.
- A failed print must not block the KDS or the dispatch queue. Show a “Print failed — retry” banner on the Expo/FOH screen and let the order continue to `READY`.

---

## 2. Notification Delivery: Africa's Talking SMS Gateway

Budget Android phones (Infinix, Tecno) aggressively suspend background browser tabs, so an in-page alert is not reliable once the customer has walked away from the screen. SMS does not depend on the browser staying open. We integrate Africa's Talking SMS API to dispatch an automated SMS when a takeaway order reaches `READY`. In Phase 1 the live status source is the staff POS/KDS; `/prototype/token` is a static design prototype, not a live customer status page.

### 2.1 SMS Notification Contract

- **Gateway:** Africa's Talking Uganda
- **Endpoint:** `POST https://api.africastalking.com/version1/messaging`
- **Trigger:** Order status updates to `READY` where `channel === 'TAKEAWAY_PICKUP'` and `customer_phone` is present. A cash walk-in without a phone has no SMS destination; staff confirm status on the POS/KDS.
- **Delivery trigger:** Do **not** send the pickup SMS to `PHONE_DELIVERY` at `READY`. The rider is being assigned from the FOH dispatch queue. An optional “Your order is on the way” SMS may be sent when FOH records the rider handoff; it must not claim live tracking or a precise ETA.
- **Cost:** ~UGX 25–30 per SMS, preventing food from cooling at the counter.

```typescript
// backend/src/services/smsService.ts (actual implementation)
// All three helpers delegate to dispatchSms, which returns:
//   { success: boolean; mode: 'MOCK' | 'LIVE' | 'FAILED'; detail?: string }
SmsService.sendPickupAlert(phone, token, outletName);
SmsService.sendDispatchAlert(phone, orderRef, riderName, riderPhone);
SmsService.sendOwnerDigest(phone, digestMessage);
```

> **Channel honesty:** `dispatchSms` returns `MOCK` in development/test and contacts no carrier; production requires a real `AFRICASTALKING_API_KEY`. There is **no email digest transport** in Phase 1, so the digest reports `emailStatus: NOT_CONFIGURED`. SMS is billed per 160-character segment; the digest summary is capped at 320 characters and links to the full report at `/d/:token` (`Daily_Audit_Digest.md §6`).

---

## 3. Electrical Resilience & Power Outage Protocol (Wandegeya Grid)

Ham Towers and the YMCA corridor experience unexpected power cuts and a 30–90 second delay while building generators fire up. The deployment must prevent tablet restarts and network drops.

```
[ UMEME GRID / GENERATOR ]
            │
            ├──► 12V DC MINI-UPS ──► Wi-Fi router + network switch
            │    (UGX 80,000; keeps the LAN alive for hours)
            │
            └──► 650–1000 VA UPS ──► Edge server (mini-PC / Pi 5, SSD)
                 (15–30 min runtime; graceful shutdown if power stays off)

┌──────────────────────────────────────┐
│       TABLET HARDWARE POLICY         │
│   - Battery-backed Android Tablets   │ ◄── Screens never blink or lose state
│   - Zero desktop monitors on AC-only │     during generator switchover
└──────────────────────────────────────┘
```

### 3.1 Hardware Specifications Checklist

- **Kitchen KDS Displays:** 10.1" Android Tablets (e.g., Lenovo Tab M10 or Teclast P30T) with internal battery. Mounted in heavy-duty silicone cases with acrylic splash protectors.
- **FOH / Waiter Handhelds:** 6.5" Android smartphones (Tecno Spark / Samsung Galaxy A04) running in PWA standalone fullscreen mode.
- **Local Edge Server (In-Store Node):** Raspberry Pi 5 (8 GB RAM) with an SSD, or a refurbished Intel NUC (i3 or better, 8–16 GB RAM, SSD) running headless Linux (Ubuntu Server), connected directly to the primary Wi-Fi router. A Raspberry Pi 4 with 2 GB is not sufficient for PostgreSQL + Fastify + static file serving; a 4 GB Pi 4 is a development fallback only, not production. This node runs the API, PostgreSQL, and the static frontend server; it does not run Redis or Next.js, and Phase 1 has no MQTT layer.
- **Router Power Backup:** 12V Mini-DC UPS connected between the wall socket and the Wi-Fi router (plus switch) to guarantee zero Wi-Fi drops during generator cutovers. This is separate from the edge-server UPS; a 12V router UPS cannot carry a mini-PC.
- **Edge Server UPS:** 650–1000 VA pure-sine UPS for the edge server and its SSD, sized for 15–30 minutes. Configure a graceful shutdown before the battery is exhausted. See `Deployment_Runbook.md §2`.

---

## 4. Physical Station Floorplan & Cabling

### 4.1 Foodizo (Ham Towers Atrium & Kitchen)
- **KDS Station 2 (Fryer/Grill):** Mounted on wall bracket, 1.8m height, 1.5m away from direct oil splatter.
- **KDS Station 3 (Rolex Griddle):** Mounted to the right of the flat griddle with heat deflector shield.
- **Expo / Dispatch Pass:** 80mm ESC/POS Thermal LAN Printer connected directly to the central Wi-Fi router via Cat5e Ethernet. It prints both the pickup bag label and the delivery chit (destination + room + phone). No rider device or in-store map screen is required in Phase 1.

### 4.2 Obunuzi (Opposite YMCA)
- **KDS Station 1 (Steam Table):** Mounted beside the hot-well bain-marie for Luwombo and Matooke portioning.
- **Bar / Beverage Monitor:** Small 8" tablet beside the drink fridge for sodas and fresh juices.
- **FOH Terminal:** Cashier desk tablet. Phase 1 shows the payment confirmation on screen and uses the Expo chit for takeaway/delivery proof; it does **not** add a second customer-receipt printer. A dedicated 58mm USB or Ethernet receipt printer is a Phase 2 option if the business requires printed customer receipts. Avoid Bluetooth receipt printers in Phase 1: Android browser support, pairing, and driver reliability are too fragile for a rush-hour counter.


---

## 5. Print Service API — Trigger Route & Fault Handling

### 5.1 Print Trigger — Actual Implementation

There is **no** public `/api/v1/print/expo-chit` endpoint and no external print-service token. Printing is internal and best-effort:

| Trigger | Code path | Behaviour |
| :--- | :--- | :--- |
| KDS bump to `READY` | `backend/src/routes/kds.ts` calls `PrinterService.printChit(...)` | Fire-and-forget; a failure is logged as `Printer chit print failed`; the order still advances |
| Manual reprint | `POST /api/v1/orders/:id/reprint-chit` (`WAITER_FOH` / `MANAGER_ADMIN`) | Builds the same chit with `reprint: true`, writes `CHIT_REPRINTED` to `audit_log`, and returns `{ success, printed, message }` |
| Cash drawer kick | `POST /api/v1/tables/drawer/kick` (`WAITER_FOH` / `MANAGER_ADMIN`) | Sends `ESC p 0 25 250`; returns the real socket outcome and writes `CASH_DRAWER_KICK_TRIGGERED` to `audit_log` |

`PrinterService` connects to `EXPO_PRINTER_IP:EXPO_PRINTER_PORT` (default `192.168.1.200:9100`) with a 2.5-second timeout. There is **no persistent print queue and no automatic retry**; if the printer is offline, the order still proceeds and staff must reprint after fixing the printer.

The chit contains the token, channel, order reference, destination/table, guest name and phone, delivery note, line items, total, and a partial cut (`GS V 66 0`).

> **Security note:** `PrinterService.sanitizeText()` strips all bytes `0x00–0x1F` and `0x7F`, collapses whitespace, and caps each field (160 characters for notes and item text, 80 for names, 24–40 for phone/token/reference fields) before the ESC/POS byte generator runs. Customer text can never inject a printer command.

---

### 5.2 Printer Fault Handling — Fail-Open Policy

**The order state (`READY`) is never held hostage to the printer.** A print failure is a hardware incident, not an order exception.

| Scenario | System Behaviour |
| :--- | :--- |
| TCP connect to `EXPO_PRINTER_IP:EXPO_PRINTER_PORT` times out (2.5 s) | `printChit` resolves `false`; the API logs a warning; the order still advances to `READY` |
| Socket refuses connection (printer off) | Same as above |
| Socket accepts the write | `printChit` resolves `true`; this means the bytes reached the socket, not that paper physically came out |
| KDS print failure | There is no KDS reprint button and no automatic retry; staff fix the printer and call the reprint endpoint |
| Manual reprint | `POST /api/v1/orders/:id/reprint-chit` writes `CHIT_REPRINTED` to `audit_log` and returns the printer outcome |
| Repeated printer failures | Operational issue; Phase 1 has no hardware-status panel, no batch reprint, and no automatic printer SMS alert |

```typescript
// Actual KDS behaviour: fire-and-forget, fail-open.
PrinterService.printChit(chit).catch((err) =>
  fastify.log.warn({ err }, 'Printer chit print failed')
);
// The order status update is not rolled back when printing fails.
```

---

### 5.3 SMS Gateway Fault Handling

**Africa's Talking SMS** is used for pickup alerts (`TOKEN-088 is ready!`), an optional "on the way" dispatch alert, and the scheduled/on-demand owner digest. It is an **external network service** and may be unreachable during internet outages.

| Scenario | System Behaviour |
| :--- | :--- |
| Development or test mode | `SmsService` returns `{ success: true, mode: 'MOCK' }`; it logs the message and contacts no carrier |
| Production without a real API key | Returns `{ success: false, mode: 'FAILED', detail: 'AFRICASTALKING_API_KEY is not configured.' }` |
| Africa's Talking returns 5xx or times out | `dispatchSms` returns `FAILED` with the provider detail; there is **no automatic retry** in Phase 1 |
| Pickup or dispatch SMS fails | The caller logs a warning; the order and KDS flow proceed normally |
| Digest SMS fails | `daily_digests.sms_status = FAILED` and the digest status is `FAILED`; the manager can retry with `POST /api/v1/digest/dispatch-now` from `/admin` |
| Internet is completely down (LAN-only mode) | SMS is impossible; staff see order state on the POS/KDS. There is no live customer status page in Phase 1 — `/prototype/token` is a static design prototype and does not call the API |

> **Rule:** SMS failure must never block an order from advancing to `COMPLETED`. SMS is a convenience notification only. Do not describe a `MOCK` result as a delivered message, and do not claim a live customer tracking page that does not exist.


---

## 6. Printing Tests & Verification

The repository does **not** ship a TCP mock-printer harness. The automated ESC/POS coverage lives in `backend/tests/printer.test.ts` and calls `PrinterService.formatChit()` directly, so it needs no hardware.

| Check | Assertion |
| :--- | :--- |
| Chit formatting | The buffer contains the token, guest name, item lines, notes, total, and the trailing `GS V 66 0` partial cut |
| Command sanitization | Control bytes `0x00–0x1F` and `0x7F` are removed from customer/item text; a crafted note cannot add an `ESC @` reset; fields are capped |

Manual hardware check:

1. Reserve `192.168.1.200` for the printer MAC and connect it over Ethernet.
2. From the edge server, run `nc -vz 192.168.1.200 9100`.
3. Bump a test order to `READY`; confirm a chit prints.
4. Stop the printer and bump another order; confirm the order still reaches `READY` and the API logs `Printer chit print failed`.
5. Restart the printer and call `POST /api/v1/orders/:id/reprint-chit`; confirm the chit and the `CHIT_REPRINTED` audit row.

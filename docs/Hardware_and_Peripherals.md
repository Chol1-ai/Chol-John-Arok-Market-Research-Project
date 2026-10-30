# Hardware, Peripherals & Operational Resilience Specification

**Target Outlets:** Foodizo (Ham Towers) & Obunuzi Restaurant & Cafe (Opposite YMCA)<br>
**Location:** Kampala, Uganda<br>
**Target Environment:** Antigravity IDE + Opencode CLI Repository Scaffold<br>
**Related Specifications:** `Foundational_Concept.md` Â· `Design_System.md` Â· `User_Flow.md` Â· `User_Profiles_Personas.md` Â· `Delivery_Zones_and_Dispatch.md` Â· `Tech_Stack.md` Â· `Payment_Integration.md` Â· `Seed_Data_and_Testing.md` Â· `Repo_Scaffold_and_Config.md` Â· `Demo_Script_and_Closing_Strategy.md` Â· `Daily_Audit_Digest.md` Â· `Deployment_Runbook.md` Â· `Service_Contract_and_Invoice_Template.md` Â · `build_strategy/Build_Strategy_and_Phases.md`

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
- If the customer did not share a GPS pin, the chit is still complete: zone + room note + phone are sufficient. Do not print â€œno locationâ€ warnings.
- Do not print the full Google Maps URL in Phase 1; it wraps badly on 80mm paper. The FOH dispatch screen carries the static link.
- Reprints are initiated only from the FOH dispatch screen and must be audit-logged. Do not expose a reprint button on the KDS.
- A delivery chit contains personal data. Hand it to the rider with the bag; do not leave it on the packing counter.

### 1.3 Printer Safety & ESC/POS Injection

- Customer-controlled text (`customerName`, `deliveryNote`, item names, item notes) must pass through `sanitizeChitText` before interpolation. The helper strips `ESC` (`0x1B`), `GS` (`0x1D`), and all control bytes, collapses whitespace, and caps length.
- Never build a raw command string from an unsanitized database value. A note such as `hello\x1B@` must print as text, not reset the printer.
- The printer is on the local LAN. Bind it to the store network only; do not expose port `9100` to the internet.
- A failed print must not block the KDS or the dispatch queue. Show a â€œPrint failed â€” retryâ€ banner on the Expo/FOH screen and let the order continue to `READY`.

---

## 2. Notification Delivery: Africa's Talking SMS Gateway

Budget Android phones (Infinix, Tecno) aggressively suspend background browser tabs, so an in-page alert is not reliable once the customer has walked away from the screen. SMS does not depend on the browser staying open. We integrate Africa's Talking SMS API to dispatch an automated SMS when a takeaway order reaches `READY`; the token page remains the source of truth when the customer keeps the tab open.

### 2.1 SMS Notification Contract

- **Gateway:** Africa's Talking Uganda
- **Endpoint:** `POST https://api.africastalking.com/version1/messaging`
- **Trigger:** Order status updates to `READY` where `channel === 'TAKEAWAY_PICKUP'` and `customer_phone` is present. A cash walk-in without a phone has no SMS destination; the token page remains the customerâ€™s status source.
- **Delivery trigger:** Do **not** send the pickup SMS to `PHONE_DELIVERY` at `READY`. The rider is being assigned from the FOH dispatch queue. An optional â€œYour order is on the wayâ€ SMS may be sent when FOH records the rider handoff; it must not claim live tracking or a precise ETA.
- **Cost:** ~UGX 25â€“30 per SMS, preventing food from cooling at the counter.

```typescript
// sms-service.ts: Africa's Talking Dispatcher
import axios from 'axios';
import querystring from 'querystring';

export async function sendPickupSmsAlert(phone: string, token: string, outletName: string) {
  const payload = {
    username: process.env.AT_USERNAME, // e.g., 'sandbox' or registered business ID
    to: phone, // E.164 without '+', e.g., '256772000000'
    message: `${outletName}: ${token} is READY for pickup at the Express Counter! Please show this token.`,
    from: process.env.AT_SENDER_ID // Shortcode or approved Alphanumeric ID
  };

  try {
    const response = await axios.post(
      'https://api.africastalking.com/version1/messaging',
      querystring.stringify(payload),
      {
        headers: {
          'apiKey': process.env.AT_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Failed to send SMS to ${phone}`, error);
    // Non-blocking error: system keeps operating even if SMS credits expire
    return null;
  }
}
```

> **Do not reuse `sendPickupSmsAlert` for other messages.** It builds a pickup-specific body (`TOKEN is READY...`). Extract a generic `sendSms(phone: string, message: string)` helper for the daily digest and operational alerts, and keep `sendPickupSmsAlert` as a thin wrapper around it. The daily digest must use the generic helper; otherwise the owner receives a malformed pickup message. SMS is billed per 160-character segment, so the digest must send a short summary and link to the full report (`Daily_Audit_Digest.md Â§3`).

---

## 3. Electrical Resilience & Power Outage Protocol (Wandegeya Grid)

Ham Towers and the YMCA corridor experience unexpected power cuts and a 30â€“90 second delay while building generators fire up. The deployment must prevent tablet restarts and network drops.

```
[ UMEME GRID / GENERATOR ]
            â”‚
            â”œâ”€â”€â–º 12V DC MINI-UPS â”€â”€â–º Wi-Fi router + network switch
            â”‚    (UGX 80,000; keeps the LAN alive for hours)
            â”‚
            â””â”€â”€â–º 650â€“1000 VA UPS â”€â”€â–º Edge server (mini-PC / Pi 5, SSD)
                 (15â€“30 min runtime; graceful shutdown if power stays off)

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚       TABLET HARDWARE POLICY         â”‚
â”‚   - Battery-backed Android Tablets   â”‚ â—„â”€â”€ Screens never blink or lose state
â”‚   - Zero desktop monitors on AC-only â”‚     during generator switchover
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 3.1 Hardware Specifications Checklist

- **Kitchen KDS Displays:** 10.1" Android Tablets (e.g., Lenovo Tab M10 or Teclast P30T) with internal battery. Mounted in heavy-duty silicone cases with acrylic splash protectors.
- **FOH / Waiter Handhelds:** 6.5" Android smartphones (Tecno Spark / Samsung Galaxy A04) running in PWA standalone fullscreen mode.
- **Local Edge Server (In-Store Node):** Raspberry Pi 5 (8 GB RAM) with an SSD, or a refurbished Intel NUC (i3 or better, 8â€“16 GB RAM, SSD) running headless Linux (Ubuntu Server), connected directly to the primary Wi-Fi router. A Raspberry Pi 4 with 2 GB is not sufficient for Next.js + PostgreSQL + Redis + Fastify; a 4 GB Pi 4 is a development fallback only, not production. This node runs the API, database, Redis, and print service; it is not a message broker, and Phase 1 has no MQTT layer.
- **Router Power Backup:** 12V Mini-DC UPS connected between the wall socket and the Wi-Fi router (plus switch) to guarantee zero Wi-Fi drops during generator cutovers. This is separate from the edge-server UPS; a 12V router UPS cannot carry a mini-PC.
- **Edge Server UPS:** 650â€“1000 VA pure-sine UPS for the edge server and its SSD, sized for 15â€“30 minutes. Configure a graceful shutdown before the battery is exhausted. See `Deployment_Runbook.md Â§2`.

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

## 5. Print Service API â€” Trigger Route & Fault Handling

### 5.1 Print Trigger API Route

Every print job is fired by the backend (never by the KDS frontend directly). When a KDS operator bumps an order to `READY`, the Fastify server calls an internal print job handler before â€” or concurrently with â€” broadcasting the `READY` WebSocket event.

```
POST /api/v1/print/expo-chit
Authorization: Internal service token (not customer-facing)

Request body:
{
  "order_id": "uuid",
  "token":    "TOKEN-088",
  "channel":  "TAKEAWAY_PICKUP" | "PHONE_DELIVERY",
  "outlet":   "FOODIZO_HAM_TOWERS" | "OBUNUZI_YMCA",
  "items": [
    { "name": "2pc Fried Chicken & Chips", "quantity": 1, "notes": "Extra hot" }
  ],
  // Delivery-only fields (omitted for TAKEAWAY_PICKUP):
  "destination_zone": "YMCA MAIN CAMPUS",
  "delivery_note":    "Block C, Room 204 â€” call at gate",
  "recipient_phone":  "+25677XXXXXXX"
}

Success response (200):
{ "status": "PRINTED", "printer_ip": "192.168.1.200", "job_id": "..." }

Failure response (503):
{ "status": "PRINT_FAILED", "error": "TCP connect timeout", "retry_available": true }
```

> **Security note:** The `delivery_note`, `recipient_phone`, and `destination_zone` fields are sanitized by `sanitizeChitText()` before being passed to the ESC/POS byte generator. Control characters (ESC, GS, NUL, and all bytes 0x00â€“0x1F and 0x7F) are stripped to prevent printer-command injection. Each field is capped at 160 characters.

---

### 5.2 Printer Fault Handling â€” Fail-Open Policy

**The order state (`READY`) is never held hostage to the printer.** A print failure is a hardware incident, not an order exception.

| Scenario | System Behaviour |
| :--- | :--- |
| TCP connect to `192.168.1.200:9100` times out (3 s) | Order advances to `READY`; error is logged to `audit_log`; KDS Expo screen shows **âš  Chit print failed â€” Re-print** button |
| Socket refuses connection (printer off) | Same as above |
| Socket open but no response within 5 s | Same as above; retry once automatically after 10 s |
| Print job succeeds on auto-retry | Button disappears; `audit_log` records retry success |
| Expo operator taps **Re-print** manually | `POST /api/v1/print/expo-chit` called again with the same `order_id` â€” idempotent re-trigger |
| Three consecutive print failures in 15 minutes | SMS alert sent to manager phone via Africa's Talking; hardware-status panel flags the printer as `OFFLINE` |
| Printer recovers while orders are queued | Admin can trigger a **"Re-print all failed chits"** batch action from `/admin/hardware` |

```typescript
// Pseudo-code: print job with fail-open
async function triggerExpoPrint(order: OrderForPrint): Promise<void> {
  try {
    const result = await printExpoChit(order); // TCP to 192.168.1.200:9100
    await auditLog({ event: 'PRINT_SUCCESS', orderId: order.id });
  } catch (err) {
    await auditLog({ event: 'PRINT_FAILED', orderId: order.id, error: String(err) });
    // Publish to Redis so the KDS screen shows the re-print button
    await redis.publish('KDS_PRINT_FAILED', JSON.stringify({ orderId: order.id }));
    // Do NOT throw â€” order proceeds to READY regardless
  }
}
```

---

### 5.3 SMS Gateway Fault Handling

**Africa's Talking SMS** is used for pickup alerts (`TOKEN-088 is ready!`) and the 21:30 owner digest summary. It is an **external network service** and may be unreachable during internet outages.

| Scenario | System Behaviour |
| :--- | :--- |
| Africa's Talking API returns 5xx or times out | Retry up to 3 times with exponential backoff (2 s, 4 s, 8 s) |
| All retries fail | Log `SMS_DELIVERY_FAILED` to `audit_log`; order proceeds normally; customer sees in-page status instead |
| Digest SMS fails | Flag in `daily_digests.sms_status = FAILED`; email digest is sent independently; manager can retry from `/admin/digest` |
| Internet is completely down (LAN-only mode) | SMS is impossible; in-page status is the fallback for customers on the local Wi-Fi; owner is notified on reconnect |

> **Rule:** SMS failure must never block an order from advancing to `COMPLETED`. The in-page token status page (`/token/[token]`) is the authoritative customer view; SMS is a convenience notification only.


---

## 6. Hardware Automated Testing Harness & Mock Printer Simulator

To test the ESC/POS printing engine without requiring a physical 80mm thermal printer on developer machines or in automated CI, developers execute tests against the built-in TCP socket simulator:

### 6.1 Mock Printer Socket Simulator (`tests/hardware/mock-printer.ts`)

```typescript
import net from 'net';

export class MockEscPosPrinter {
  private server: net.Server;
  public receivedBuffers: Buffer[] = [];
  public shouldTimeout = false;
  public shouldRefuse = false;

  constructor(public port = 9100) {
    this.server = net.createServer((socket) => {
      if (this.shouldTimeout) {
        // Hold socket open without acknowledging data to simulate hung printer
        return;
      }

      socket.on('data', (data) => {
        this.receivedBuffers.push(data);
      });

      socket.on('end', () => {
        socket.end();
      });
    });
  }

  async start(): Promise<void> {
    if (this.shouldRefuse) return;
    return new Promise((resolve) => {
      this.server.listen(this.port, '127.0.0.1', () => resolve());
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  clear(): void {
    this.receivedBuffers = [];
  }
}
```

---

### 6.2 Printer Integration & Fail-Open Verification Test (`tests/integration/printer.test.ts`)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockEscPosPrinter } from '../hardware/mock-printer';
import { generateExpoBagLabel } from '../../src/server/services/escpos-generator';
import { sendRawEscPosToPrinter } from '../../src/server/services/printer-client';

describe('ESC/POS Thermal Printing & Fail-Open Harness', () => {
  let printer: MockEscPosPrinter;

  beforeEach(async () => {
    printer = new MockEscPosPrinter(9100);
    await printer.start();
  });

  afterEach(async () => {
    await printer.stop();
  });

  it('generates valid ESC/POS byte sequence with initialization and paper cut', () => {
    const chit = generateExpoBagLabel({
      digitalToken: 'TOKEN-088',
      customerName: 'Brian K.',
      channel: 'PHONE_DELIVERY',
      destinationZone: 'YMCA MAIN CAMPUS',
      deliveryNote: 'Block C, Room 204',
      customerPhone: '+256772123456',
      items: [{ name: '2pc Fried Chicken & Chips', quantity: 1 }],
      timestamp: '2026-10-30 13:15 EAT',
    });

    const rawHex = chit.toString('hex');
    expect(rawHex).toContain('1b40'); // ESC @ (Initialize)
    expect(rawHex).toContain('544f4b454e2d303838'); // "TOKEN-088" ASCII
    expect(rawHex).toContain('1d564200'); // GS V 66 0 (Cut Paper)
  });

  it('prints successfully to LAN printer socket under normal conditions', async () => {
    const chit = generateExpoBagLabel({
      digitalToken: 'TOKEN-088',
      customerName: 'Brian K.',
      channel: 'TAKEAWAY_PICKUP',
      items: [{ name: 'Rolex (2 Eggs)', quantity: 2 }],
      timestamp: '2026-10-30 13:15 EAT',
    });

    const success = await sendRawEscPosToPrinter('127.0.0.1', 9100, chit, 3000);
    expect(success).toBe(true);
    expect(printer.receivedBuffers.length).toBeGreaterThan(0);
  });

  it('enforces fail-open: returns false on timeout without throwing unhandled exceptions', async () => {
    printer.shouldTimeout = true;
    const chit = Buffer.from('TEST');

    // Attempt print with 500ms timeout
    const result = await sendRawEscPosToPrinter('127.0.0.1', 9100, chit, 500);
    expect(result).toBe(false); // Handled gracefully; order proceeds to READY
  });
});
```

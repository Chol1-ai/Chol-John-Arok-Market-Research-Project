import net from 'net';
import { config } from '../config.js';

export interface ChitData {
  orderNumber: string;
  tokenNumber: string;
  channel: string;
  tableOrZone?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryNotes?: string;
  items: Array<{ name: string; quantity: number; notes?: string }>;
  totalUgx: number;
  reprint?: boolean;
}

export class PrinterService {
  /**
   * Strips ESC/POS control bytes from operator/customer text and caps the
   * field length. Text is never allowed to inject printer commands.
   */
  static sanitizeText(value: string | undefined, maxLength = 160): string {
    if (!value) return '';
    return value
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  /**
   * Generates ESC/POS formatted byte buffer for an 80mm thermal receipt printer.
   */
  static formatChit(data: ChitData): Buffer {
    const ESC = 0x1B;
    const GS = 0x1D;

    const commands: number[] = [
      ESC, 0x40,           // Initialize printer
      ESC, 0x61, 0x01,     // Center align
      GS, 0x21, 0x11,      // Double width + double height
    ];

    const appendText = (text: string) => {
      const buf = Buffer.from(text + '\n', 'utf8');
      for (const b of buf) commands.push(b);
    };

    appendText(`TOKEN ${this.sanitizeText(data.tokenNumber, 32)}`);
    if (data.reprint) {
      appendText('*** REPRINT ***');
    }
    
    // Normal text, left align
    commands.push(GS, 0x21, 0x00);
    commands.push(ESC, 0x61, 0x00);
    
    appendText('------------------------------------------');
    appendText(
      `Channel: ${this.sanitizeText(data.channel, 40)} | Ref: ${this.sanitizeText(
        data.orderNumber,
        40
      ).substring(0, 8)}`
    );
    if (data.tableOrZone) {
      appendText(`Destination: ${this.sanitizeText(data.tableOrZone)}`);
    }
    if (data.customerName) {
      appendText(
        `Guest: ${this.sanitizeText(data.customerName, 80)} (${this.sanitizeText(
          data.customerPhone,
          24
        ) || 'No Phone'})`
      );
    }
    if (data.deliveryNotes) {
      appendText(`Notes: ${this.sanitizeText(data.deliveryNotes)}`);
    }
    appendText('------------------------------------------');

    // Items
    for (const item of data.items) {
      appendText(`${item.quantity}x ${this.sanitizeText(item.name)}`);
      if (item.notes) {
        appendText(`   * ${this.sanitizeText(item.notes)}`);
      }
    }

    appendText('------------------------------------------');
    appendText(`TOTAL: UGX ${data.totalUgx.toLocaleString()}`);
    appendText('------------------------------------------\n\n');

    // Partial Cut (GS V 66 0)
    commands.push(GS, 0x56, 0x42, 0x00);

    return Buffer.from(commands);
  }

  /**
   * Sends raw print bytes to network thermal printer.
   * Fail-open: Never throws uncaught error if printer is offline.
   */
  /**
   * Sends the ESC/POS drawer-kick pulse (ESC p 0 25 250). Returns the real
   * socket outcome, never a simulated "release confirmed".
   */
  static async kickDrawer(): Promise<boolean> {
    const pulse = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setTimeout(2500);

      client.connect(config.EXPO_PRINTER_PORT, config.EXPO_PRINTER_IP, () => {
        client.write(pulse, () => {
          client.end();
          resolve(true);
        });
      });

      client.on('error', (err) => {
        console.warn(`[PrinterService] Drawer kick failed (${config.EXPO_PRINTER_IP}): ${err.message}`);
        client.destroy();
        resolve(false);
      });

      client.on('timeout', () => {
        console.warn(`[PrinterService] Drawer kick timed out (${config.EXPO_PRINTER_IP}).`);
        client.destroy();
        resolve(false);
      });
    });
  }

  static async printChit(data: ChitData): Promise<boolean> {
    const chitBuffer = this.formatChit(data);

    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setTimeout(2500); // 2.5s timeout

      client.connect(config.EXPO_PRINTER_PORT, config.EXPO_PRINTER_IP, () => {
        client.write(chitBuffer, () => {
          client.end();
          resolve(true);
        });
      });

      client.on('error', (err) => {
        console.warn(`[PrinterService] Network printer unreachable (${config.EXPO_PRINTER_IP}): ${err.message}. Fail-open.`);
        client.destroy();
        resolve(false);
      });

      client.on('timeout', () => {
        console.warn(`[PrinterService] Network printer timed out (${config.EXPO_PRINTER_IP}). Fail-open.`);
        client.destroy();
        resolve(false);
      });
    });
  }
}


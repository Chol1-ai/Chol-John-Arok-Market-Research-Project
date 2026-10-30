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
}

export class PrinterService {
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

    appendText(`TOKEN ${data.tokenNumber}`);
    
    // Normal text, left align
    commands.push(GS, 0x21, 0x00);
    commands.push(ESC, 0x61, 0x00);
    
    appendText('------------------------------------------');
    appendText(`Channel: ${data.channel} | Ref: ${data.orderNumber.substring(0, 8)}`);
    if (data.tableOrZone) {
      appendText(`Destination: ${data.tableOrZone}`);
    }
    if (data.customerName) {
      appendText(`Guest: ${data.customerName} (${data.customerPhone || 'No Phone'})`);
    }
    if (data.deliveryNotes) {
      appendText(`Notes: ${data.deliveryNotes}`);
    }
    appendText('------------------------------------------');

    // Items
    for (const item of data.items) {
      appendText(`${item.quantity}x ${item.name}`);
      if (item.notes) {
        appendText(`   * ${item.notes}`);
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


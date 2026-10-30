import { describe, it, expect } from 'vitest';
import { PrinterService, ChitData } from '../src/services/printerService.js';

describe('PrinterService (ESC/POS 80mm Chit Formatting)', () => {
  it('formats raw ESC/POS bytes with token, items, total and cut command', () => {
    const mockChit: ChitData = {
      orderNumber: 'ORD-123456',
      tokenNumber: '#F-104',
      channel: 'TAKEAWAY_PICKUP',
      customerName: 'Brian K.',
      customerPhone: '0772123456',
      items: [
        { name: '2pc Fried Chicken & Chips', quantity: 1, notes: 'Extra chili dip' },
        { name: 'Regular Rolex', quantity: 2 }
      ],
      totalUgx: 21000
    };

    const buffer = PrinterService.formatChit(mockChit);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(50);

    const stringRepresentation = buffer.toString('utf8');
    expect(stringRepresentation).toContain('TOKEN #F-104');
    expect(stringRepresentation).toContain('Brian K.');
    expect(stringRepresentation).toContain('2pc Fried Chicken & Chips');
    expect(stringRepresentation).toContain('Extra chili dip');
    expect(stringRepresentation).toContain('UGX 21,000');

    // Verify trailing GS V 66 0 partial paper cut command
    const len = buffer.length;
    expect(buffer[len - 4]).toBe(0x1D); // GS
    expect(buffer[len - 3]).toBe(0x56); // V
    expect(buffer[len - 2]).toBe(0x42); // 66
    expect(buffer[len - 1]).toBe(0x00); // 0
  });
});


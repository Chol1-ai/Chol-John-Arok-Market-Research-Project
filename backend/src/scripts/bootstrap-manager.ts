import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeUgandanPhone } from '../utils/phone.js';

type Outlet = 'FOODIZO_HAM_TOWERS' | 'OBUNUZI_YMCA';

const prisma = new PrismaClient();

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

async function bootstrapManager(): Promise<void> {
  requiredEnvironmentValue('DATABASE_URL');
  const confirmation = requiredEnvironmentValue('BOOTSTRAP_MANAGER_CONFIRM');
  const fullName = requiredEnvironmentValue('BOOTSTRAP_MANAGER_FULL_NAME');
  const phoneNumber = normalizeUgandanPhone(
    requiredEnvironmentValue('BOOTSTRAP_MANAGER_PHONE')
  );
  const pin = requiredEnvironmentValue('BOOTSTRAP_MANAGER_PIN');
  const outletValue = requiredEnvironmentValue('BOOTSTRAP_MANAGER_OUTLET');

  if (confirmation !== 'CREATE_MANAGER') {
    throw new Error('Set BOOTSTRAP_MANAGER_CONFIRM to CREATE_MANAGER to continue.');
  }
  if (fullName.length < 2 || fullName.length > 100) {
    throw new Error('BOOTSTRAP_MANAGER_FULL_NAME must be between 2 and 100 characters.');
  }
  if (!/^256\d{9}$/.test(phoneNumber)) {
    throw new Error('BOOTSTRAP_MANAGER_PHONE must be a valid Ugandan mobile number.');
  }
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('BOOTSTRAP_MANAGER_PIN must be exactly four digits.');
  }
  if (
    outletValue !== 'FOODIZO_HAM_TOWERS' &&
    outletValue !== 'OBUNUZI_YMCA'
  ) {
    throw new Error(
      'BOOTSTRAP_MANAGER_OUTLET must be FOODIZO_HAM_TOWERS or OBUNUZI_YMCA.'
    );
  }
  const outlet: Outlet = outletValue;
  const pinHash = await bcrypt.hash(pin, 12);

  const manager = await prisma.$transaction(
    async (transaction) => {
      const existingManager = await transaction.users.findFirst({
        where: { role: 'MANAGER_ADMIN', outlet },
        select: { id: true }
      });
      if (existingManager) {
        throw new Error(`A manager account already exists for ${outlet}.`);
      }

      const existingPhone = await transaction.users.findUnique({
        where: { phone_number: phoneNumber },
        select: { id: true }
      });
      if (existingPhone) {
        throw new Error('That phone number is already assigned to an account.');
      }

      const created = await transaction.users.create({
        data: {
          full_name: fullName,
          phone_number: phoneNumber,
          pin_hash: pinHash,
          role: 'MANAGER_ADMIN',
          outlet
        },
        select: { id: true, full_name: true, outlet: true }
      });

      await transaction.audit_log.create({
        data: {
          outlet,
          action: 'INITIAL_MANAGER_BOOTSTRAPPED',
          entity_type: 'USER',
          entity_id: created.id,
          after_json: {
            fullName: created.full_name,
            role: 'MANAGER_ADMIN',
            outlet: created.outlet
          }
        }
      });

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  console.log(
    `Created manager ${manager.full_name} for ${manager.outlet}. Sign in with the registered phone number and PIN; the PIN was not logged.`
  );
}

bootstrapManager()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? `Manager bootstrap failed: ${error.message}` : 'Manager bootstrap failed.'
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

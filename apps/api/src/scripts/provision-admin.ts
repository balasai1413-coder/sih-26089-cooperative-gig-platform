import { AdminProvisioningService } from '../auth/admin-provisioning.service';
import { PrismaService } from '../database/prisma.service';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set for admin provisioning`);
  return value;
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    const admin = await new AdminProvisioningService(prisma).provision({
      mobile: required('ADMIN_MOBILE'),
      password: required('ADMIN_PASSWORD'),
      email: process.env.ADMIN_EMAIL?.trim() || undefined,
      cooperativeId: process.env.ADMIN_COOPERATIVE_ID?.trim() || undefined,
    });
    console.log(`Provisioned cooperative admin ${admin.mobile} (${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin provisioning failed');
  process.exitCode = 1;
});
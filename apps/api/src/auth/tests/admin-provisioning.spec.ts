import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AdminProvisioningService } from '../admin-provisioning.service';

describe('Admin provisioning', () => {
  it('creates a server-provisioned admin and assigns the requested cooperative', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'admin-user',
          mobile: data.mobile,
          email: data.email ?? null,
          role: data.role,
        })),
        update: jest.fn(),
      },
      cooperative: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cooperative-a', adminUserId: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new AdminProvisioningService(prisma as never);

    const result = await service.provision({
      mobile: '+919876543210',
      email: 'admin@example.com',
      password: 'admin-password-123',
      cooperativeId: 'cooperative-a',
    });

    expect(result.role).toBe(UserRole.COOPERATIVE_ADMIN);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.COOPERATIVE_ADMIN }),
      }),
    );
    const passwordHash = prisma.user.create.mock.calls[0][0].data.passwordHash as string;
    expect(await bcrypt.compare('admin-password-123', passwordHash)).toBe(true);
    expect(prisma.cooperative.update).toHaveBeenCalledWith({
      where: { id: 'cooperative-a' },
      data: { adminUserId: 'admin-user' },
    });
  });

  it('rejects assigning a cooperative that belongs to another administrator', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'admin-user' }),
        update: jest.fn().mockResolvedValue({
          id: 'admin-user',
          mobile: '+919876543210',
          email: null,
          role: UserRole.COOPERATIVE_ADMIN,
        }),
      },
      cooperative: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cooperative-a', adminUserId: 'other-admin' }),
        update: jest.fn(),
      },
    };
    const service = new AdminProvisioningService(prisma as never);

    await expect(
      service.provision({
        mobile: '+919876543210',
        password: 'admin-password-123',
        cooperativeId: 'cooperative-a',
      }),
    ).rejects.toThrow('Cooperative already has another administrator');
    expect(prisma.cooperative.update).not.toHaveBeenCalled();
  });
});
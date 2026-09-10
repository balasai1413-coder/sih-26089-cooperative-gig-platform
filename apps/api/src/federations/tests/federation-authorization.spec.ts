import { FederationMembershipStatus, UserRole } from '@prisma/client';
import { FederationsService } from '../federations.service';

const actor = {
  id: 'cooperative-admin-a',
  mobile: '9000000000',
  email: null,
  role: UserRole.COOPERATIVE_ADMIN,
};

function serviceForAdministrator(administratorId: string | null) {
  const prisma = {
    federationAdministrator: {
      findFirst: jest.fn().mockResolvedValue(administratorId ? { id: administratorId } : null),
    },
    federation: { findUnique: jest.fn(), findMany: jest.fn() },
  };
  return {
    service: new FederationsService(prisma as never, {} as never),
    prisma,
  };
}

describe('Federation authorization', () => {
  it('rejects a cooperative admin who is not an administrator of the target federation', async () => {
    const { service } = serviceForAdministrator(null);

    await expect(service.get(actor, 'federation-b')).rejects.toThrow(
      'You do not have permission to access this federation',
    );
  });

  it('does not use a cooperative admin relationship as federation authorization', async () => {
    const { service, prisma } = serviceForAdministrator(null);

    await expect(
      service.updateMembership(
        actor,
        'federation-b',
        'cooperative-a',
        FederationMembershipStatus.ACTIVE,
      ),
    ).rejects.toThrow('You do not have permission to access this federation');
    expect(prisma.federationAdministrator.findFirst).toHaveBeenCalledWith({
      where: { federationId: 'federation-b', userId: actor.id },
      select: { id: true },
    });
  });

  it('allows only the persisted federation administrator to reach federation data', async () => {
    const { service, prisma } = serviceForAdministrator('federation-admin-link');
    prisma.federation.findUnique.mockResolvedValue({
      id: 'federation-a',
      name: 'Federation A',
      code: 'FED-A',
      description: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-09-11T00:00:00.000Z'),
      updatedAt: new Date('2026-09-11T00:00:00.000Z'),
    });
    jest.spyOn(service as never, 'getOverview' as never).mockResolvedValue({} as never);

    await expect(service.get(actor, 'federation-a')).resolves.toMatchObject({ id: 'federation-a' });
  });
});

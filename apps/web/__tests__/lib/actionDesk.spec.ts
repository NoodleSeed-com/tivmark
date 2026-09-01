import { Role } from '@prisma/client';

import {
  canManageActionDesk,
  DEFAULT_ACTION_SERVICES,
} from 'models/actionDesk';

describe('Action Desk defaults and authorization', () => {
  it('starts every team with broadly reusable business services', () => {
    expect(DEFAULT_ACTION_SERVICES.map((service) => service.slug)).toEqual([
      'sales-consultation',
      'customer-support',
      'software-access',
      'general-request',
    ]);
    expect(
      new Set(DEFAULT_ACTION_SERVICES.map((service) => service.audience))
    ).toEqual(new Set(['PUBLIC', 'CUSTOMER', 'EMPLOYEE']));
  });

  it('reserves catalog and queue operation for owners and admins', () => {
    expect(canManageActionDesk({ role: Role.OWNER })).toBe(true);
    expect(canManageActionDesk({ role: Role.ADMIN })).toBe(true);
    expect(canManageActionDesk({ role: Role.MEMBER })).toBe(false);
  });
});

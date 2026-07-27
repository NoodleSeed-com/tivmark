import { buildTeamNavigation } from '@/components/shared/shell/TeamNavigation';
import { buildUserNavigation } from '@/components/shared/shell/UserNavigation';

const labels = {
  mark: 'Mark',
  allTeams: 'All Teams',
  account: 'Account',
  security: 'Security',
  timeOff: 'Time Off',
  equipment: 'Equipment',
  settings: 'Settings',
};

describe('Mark navigation', () => {
  it('is the first account-level destination and is active on /mark', () => {
    const menus = buildUserNavigation('/mark', labels);

    expect(
      menus.map(({ name, href, active }) => ({ name, href, active }))
    ).toEqual([
      { name: 'Mark', href: '/mark', active: true },
      { name: 'All Teams', href: '/teams', active: false },
      { name: 'Account', href: '/settings/account', active: false },
      { name: 'Security', href: '/settings/security', active: false },
    ]);
  });

  it('places global Mark between team equipment and settings', () => {
    const menus = buildTeamNavigation('acme', '/mark', labels);

    expect(
      menus.map(({ name, href, active }) => ({ name, href, active }))
    ).toEqual([
      {
        name: 'Time Off',
        href: '/teams/acme/time-off',
        active: false,
      },
      {
        name: 'Equipment',
        href: '/teams/acme/equipment',
        active: false,
      },
      { name: 'Mark', href: '/mark', active: true },
      {
        name: 'Settings',
        href: '/teams/acme/settings',
        active: false,
      },
    ]);
  });
});

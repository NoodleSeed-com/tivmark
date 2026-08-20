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
  it('opens the drawer from the account menu without navigating anywhere', () => {
    const openMark = jest.fn();
    const menus = buildUserNavigation('/teams', labels, openMark);

    const mark = menus[0]!;
    expect(mark.name).toBe('Mark');
    // Mark is not a page: no href means no navigation, which is what keeps the sidebar
    // the user is looking at from ever changing.
    expect(mark.href).toBeUndefined();
    mark.onClick?.();
    expect(openMark).toHaveBeenCalled();

    expect(menus.slice(1).map(({ name, href }) => ({ name, href }))).toEqual([
      { name: 'All Teams', href: '/teams' },
      { name: 'Account', href: '/settings/account' },
      { name: 'Security', href: '/settings/security' },
    ]);
  });

  it('opens the drawer from the team menu, leaving time off and equipment in place', () => {
    const openMark = jest.fn();
    const menus = buildTeamNavigation(
      'acme',
      '/teams/acme/time-off',
      labels,
      openMark
    );

    expect(menus.map(({ name, href }) => ({ name, href }))).toEqual([
      { name: 'Time Off', href: '/teams/acme/time-off' },
      { name: 'Equipment', href: '/teams/acme/equipment' },
      { name: 'Mark', href: undefined },
      { name: 'Settings', href: '/teams/acme/settings' },
    ]);

    menus[2]!.onClick?.();
    expect(openMark).toHaveBeenCalled();
  });
});

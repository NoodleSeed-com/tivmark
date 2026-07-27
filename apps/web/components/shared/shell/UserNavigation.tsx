import {
  RectangleStackIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { MenuItem, NavigationProps } from './NavigationItems';

interface UserNavigationLabels {
  mark: string;
  allTeams: string;
  account: string;
  security: string;
}

export function buildUserNavigation(
  activePathname: string | null,
  labels: UserNavigationLabels
): MenuItem[] {
  return [
    {
      name: labels.mark,
      href: '/mark',
      icon: SparklesIcon,
      active: activePathname === '/mark',
    },
    {
      name: labels.allTeams,
      href: '/teams',
      icon: RectangleStackIcon,
      active: activePathname === '/teams',
    },
    {
      name: labels.account,
      href: '/settings/account',
      icon: UserCircleIcon,
      active: activePathname === '/settings/account',
    },
    {
      name: labels.security,
      href: '/settings/security',
      icon: ShieldCheckIcon,
      active: activePathname === '/settings/security',
    },
  ];
}

const UserNavigation = ({ activePathname }: NavigationProps) => {
  const { t } = useTranslation('common');

  const menus = buildUserNavigation(activePathname, {
    mark: t('mark'),
    allTeams: t('all-teams'),
    account: t('account'),
    security: t('security'),
  });

  return <NavigationItems menus={menus} />;
};

export default UserNavigation;

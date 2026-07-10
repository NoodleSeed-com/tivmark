import { CalendarDaysIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { NavigationProps, MenuItem } from './NavigationItems';

interface NavigationItemsProps extends NavigationProps {
  slug: string;
}

const TeamNavigation = ({ slug, activePathname }: NavigationItemsProps) => {
  const { t } = useTranslation('common');

  const menus: MenuItem[] = [
    {
      name: t('time-off'),
      href: `/teams/${slug}/time-off`,
      icon: CalendarDaysIcon,
      active: activePathname === `/teams/${slug}/time-off`,
    },
    {
      name: t('settings'),
      href: `/teams/${slug}/settings`,
      icon: Cog6ToothIcon,
      active:
        activePathname?.startsWith(`/teams/${slug}`) &&
        !activePathname.includes('time-off') &&
        !activePathname.includes('products'),
    },
  ];

  return <NavigationItems menus={menus} />;
};

export default TeamNavigation;

import {
  CalendarDaysIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { NavigationProps, MenuItem } from './NavigationItems';
import { openAssistant } from './assistantSurface';

interface NavigationItemsProps extends NavigationProps {
  slug: string;
}

interface TeamNavigationLabels {
  mark: string;
  timeOff: string;
  equipment: string;
  settings: string;
}

export function buildTeamNavigation(
  slug: string,
  activePathname: string | null,
  labels: TeamNavigationLabels,
  openMark: () => void = () => openAssistant()
): MenuItem[] {
  return [
    {
      name: labels.timeOff,
      href: `/teams/${slug}/time-off`,
      icon: CalendarDaysIcon,
      active: activePathname === `/teams/${slug}/time-off`,
    },
    {
      name: labels.equipment,
      href: `/teams/${slug}/equipment`,
      icon: ComputerDesktopIcon,
      active: activePathname === `/teams/${slug}/equipment`,
    },
    {
      // Mark is not a page: this opens the assistant drawer in place, keeping the team's
      // time-off / equipment menu exactly where it was.
      name: labels.mark,
      onClick: openMark,
      icon: SparklesIcon,
    },
    {
      name: labels.settings,
      href: `/teams/${slug}/settings`,
      icon: Cog6ToothIcon,
      active:
        activePathname?.startsWith(`/teams/${slug}`) &&
        !activePathname.includes('time-off') &&
        !activePathname.includes('equipment') &&
        !activePathname.includes('products'),
    },
  ];
}

const TeamNavigation = ({ slug, activePathname }: NavigationItemsProps) => {
  const { t } = useTranslation('common');

  const menus = buildTeamNavigation(slug, activePathname, {
    mark: t('mark'),
    timeOff: t('time-off'),
    equipment: t('equipment'),
    settings: t('settings'),
  });

  return <NavigationItems menus={menus} />;
};

export default TeamNavigation;

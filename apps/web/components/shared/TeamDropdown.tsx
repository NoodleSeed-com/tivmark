import {
  ChevronUpDownIcon,
  FolderIcon,
  FolderPlusIcon,
  RectangleStackIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import useTeams from 'hooks/useTeams';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { maxLengthPolicies } from '@/lib/common';

const TeamDropdown = () => {
  const router = useRouter();
  const { teams } = useTeams();
  const { data } = useSession();
  const { t } = useTranslation('common');

  const currentTeam = (teams || []).find(
    (team) => team.slug === router.query.slug
  );

  const menus = [
    {
      id: 2,
      name: t('teams'),
      items: (teams || []).map((team) => ({
        id: team.id,
        name: team.name,
        href: `/teams/${team.slug}/settings`,
        icon: FolderIcon,
      })),
    },
    {
      id: 1,
      name: t('profile'),
      items: [
        {
          id: data?.user.id,
          name: data?.user?.name,
          href: '/settings/account',
          icon: UserCircleIcon,
        },
      ],
    },
    {
      id: 3,
      name: '',
      items: [
        {
          id: 'all-teams',
          name: t('all-teams'),
          href: '/teams',
          icon: RectangleStackIcon,
        },
        {
          id: 'new-team',
          name: t('new-team'),
          href: '/teams?newTeam=true',
          icon: FolderPlusIcon,
        },
      ],
    },
  ];

  return (
    <div className="dropdown w-full">
      <div
        tabIndex={0}
        className="flex h-10 cursor-pointer items-center justify-between rounded-none border border-ui-border bg-ui-surface px-4 text-sm font-semibold text-ui-heading"
      >
        {currentTeam?.name ||
          data?.user?.name?.substring(
            0,
            maxLengthPolicies.nameShortDisplay
          )}{' '}
        <ChevronUpDownIcon className="w-5 h-5" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content w-full rounded-none border border-ui-border bg-ui-surface p-2 px-2 text-ui-text shadow-md"
      >
        {menus.map(({ id, name, items }) => {
          return (
            <React.Fragment key={id}>
              {name && (
                <li
                  className="px-2 py-1 text-xs text-ui-muted"
                  key={`${id}-name`}
                >
                  {name}
                </li>
              )}
              {items.map((item) => (
                <li
                  key={`${id}-${item.id}`}
                  onClick={() => {
                    if (document.activeElement) {
                      (document.activeElement as HTMLElement).blur();
                    }
                  }}
                >
                  <Link href={item.href}>
                    <div className="flex items-center gap-2 rounded-none px-2 py-2 text-sm font-medium hover:bg-ui-surface-muted focus:bg-ui-surface-muted focus:outline-none">
                      <item.icon className="h-5 w-5 text-tivmark-gold" />{' '}
                      {item.name}
                    </div>
                  </Link>
                </li>
              ))}
              {name && <li className="divider m-0" key={`${id}-divider`} />}
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
};

export default TeamDropdown;

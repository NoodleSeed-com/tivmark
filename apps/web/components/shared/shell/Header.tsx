import Link from 'next/link';
import React from 'react';
import { useSession } from 'next-auth/react';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useTranslation } from 'next-i18next';
import { useCustomSignOut } from 'hooks/useCustomSignout';
import { ThemeToggle } from '@/components/shared';

interface HeaderProps {
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Header = ({ setSidebarOpen }: HeaderProps) => {
  const { status, data } = useSession();
  const { t } = useTranslation('common');
  const signOut = useCustomSignOut();

  if (status === 'loading' || !data) {
    return null;
  }

  const { user } = data;

  return (
    <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-ui-border bg-ui-surface px-4 text-ui-text shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-ui-heading lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">{t('open-sidebar')}</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="relative flex flex-1"></div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <ThemeToggle />
          <div className="dropdown dropdown-end">
            <div className="flex items-center cursor-pointer" tabIndex={0}>
              <span className="hidden lg:flex lg:items-center">
                <button
                  className="ml-4 text-sm font-semibold leading-6 text-ui-heading"
                  aria-hidden="true"
                >
                  {user.name}
                </button>
                <ChevronDownIcon
                  className="ml-2 h-5 w-5 text-ui-accent"
                  aria-hidden="true"
                />
              </span>
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu z-[1] w-40 space-y-1 rounded-none border border-ui-border bg-ui-surface p-2 text-ui-text shadow-lg"
            >
              <li
                onClick={() => {
                  if (document.activeElement) {
                    (document.activeElement as HTMLElement).blur();
                  }
                }}
              >
                <Link
                  href="/settings/account"
                  className="block cursor-pointer px-2 py-1 text-sm leading-6 text-ui-text hover:bg-ui-surface-muted"
                >
                  <div className="flex items-center">
                    <UserCircleIcon className="w-5 h-5 mr-1" /> {t('account')}
                  </div>
                </Link>
              </li>

              <li>
                <button
                  className="block cursor-pointer px-2 py-1 text-sm leading-6 text-ui-text hover:bg-ui-surface-muted"
                  type="button"
                  onClick={signOut}
                >
                  <div className="flex items-center">
                    <ArrowRightOnRectangleIcon className="w-5 h-5 mr-1" />{' '}
                    {t('logout')}
                  </div>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;

import Link from 'next/link';
import classNames from 'classnames';

export interface MenuItem {
  name: string;
  /** Destination for link items. Omitted when `onClick` is set. */
  href?: string;
  /** Action items (e.g. opening the assistant drawer) render as buttons and never navigate. */
  onClick?: () => void;
  icon?: any;
  active?: boolean;
  items?: Omit<MenuItem, 'icon' | 'items'>[];
  className?: string;
}

export interface NavigationProps {
  activePathname: string | null;
}

interface NavigationItemsProps {
  menus: MenuItem[];
}

interface NavigationItemProps {
  menu: MenuItem;
  className?: string;
}

const NavigationItems = ({ menus }: NavigationItemsProps) => {
  return (
    <ul role="list" className="flex flex-1 flex-col gap-1">
      {menus.map((menu) => (
        <li key={menu.name}>
          <NavigationItem menu={menu} />
          {menu.items && (
            <ul className="flex flex-col gap-1 mt-1">
              {menu.items.map((subitem) => (
                <li key={subitem.name}>
                  <NavigationItem menu={subitem} className="pl-9" />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
};

const NavigationItem = ({ menu, className }: NavigationItemProps) => {
  const sharedClassName = classNames(
    'group flex items-center gap-2 rounded-none p-2 px-2 text-sm text-ui-heading hover:bg-ui-surface-muted hover:text-ui-heading',
    menu.active &&
      'bg-tivmark-navy font-semibold text-white dark:bg-tivmark-gold dark:text-tivmark-deep',
    className
  );

  const content = (
    <>
      {menu.icon && (
        <menu.icon
          className={classNames({
            'h-5 w-5 shrink-0 text-ui-accent group-hover:text-ui-heading': true,
            'text-tivmark-gold-light dark:text-tivmark-deep': menu.active,
          })}
          aria-hidden="true"
        />
      )}
      {menu.name}
    </>
  );

  // Action items open something in place -- the sidebar the user is looking at must not
  // change, so these never navigate.
  if (menu.onClick) {
    return (
      <button
        type="button"
        onClick={menu.onClick}
        className={`w-full text-left ${sharedClassName}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={menu.href ?? '#'} className={sharedClassName}>
      {content}
    </Link>
  );
};

export default NavigationItems;

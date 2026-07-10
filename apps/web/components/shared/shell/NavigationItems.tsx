import Link from 'next/link';
import classNames from 'classnames';

export interface MenuItem {
  name: string;
  href: string;
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
  return (
    <Link
      href={menu.href}
      className={`group flex items-center gap-2 rounded-none p-2 px-2 text-sm text-ui-heading hover:bg-ui-surface-muted hover:text-ui-heading ${
        menu.active
          ? 'bg-tivmark-navy font-semibold text-white dark:bg-tivmark-gold dark:text-tivmark-deep'
          : ''
      }${className}`}
    >
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
    </Link>
  );
};

export default NavigationItems;

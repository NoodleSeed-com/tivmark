import Image from 'next/image';

import app from '@/lib/app';

interface ThemeLogoProps {
  className?: string;
  priority?: boolean;
}

const ThemeLogo = ({
  className = 'w-40',
  priority = false,
}: ThemeLogoProps) => {
  const imageClassName = `h-auto ${className}`;

  return (
    <span className="inline-flex items-center">
      <Image
        src={app.logoUrl}
        alt={app.name}
        width={1997}
        height={703}
        className={`${imageClassName} dark:hidden`}
        priority={priority}
      />
      <Image
        src={app.logoUrlDark}
        alt={app.name}
        width={1997}
        height={703}
        className={`hidden ${imageClassName} dark:block`}
        priority={priority}
      />
    </span>
  );
};

export default ThemeLogo;

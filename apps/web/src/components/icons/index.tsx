import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

export type IconName =
  | 'arrow-right'
  | 'arrow-up-right'
  | 'briefcase'
  | 'building'
  | 'check'
  | 'chevron-down'
  | 'close'
  | 'compass'
  | 'eye'
  | 'eye-off'
  | 'grid'
  | 'lock'
  | 'log-out'
  | 'menu'
  | 'message'
  | 'plus'
  | 'search'
  | 'shield'
  | 'sparkles'
  | 'user'
  | 'users'
  | 'verify'
  | 'zap';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

const paths: Record<IconName, React.ReactNode> = {
  'arrow-right': <path d="M5 12h14m-6-6 6 6-6 6" />,
  'arrow-up-right': <path d="M7 17 17 7M8 7h9v9" />,
  briefcase: (
    <path d="M9 6V4h6v2m5 3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM2 13h20" />
  ),
  building: (
    <path d="M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M14 9h5a1 1 0 0 1 1 1v11M8 7h2m-2 4h2m-2 4h2m8 2h1" />
  ),
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  compass: (
    <path d="m15.5 8.5-3 3-4 1 1-4 3-3 3-1-1 4Z M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
  ),
  eye: (
    <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  ),
  'eye-off': (
    <path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17.5 17.5 0 0 1-3.1 3.8M6.2 6.3A17 17 0 0 0 2.5 12s3.4 6 9.5 6c1.4 0 2.6-.3 3.7-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  ),
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  lock: (
    <path d="M6 10V7a6 6 0 0 1 12 0v3m-12 0h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm6 4v4" />
  ),
  'log-out': <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m5-4 4-4-4-4m4 4H9" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  message: (
    <path d="M21 11.5a8 8 0 0 1-8.3 8 9.5 9.5 0 0 1-3.7-.8L3 21l1.9-5.2A7.5 7.5 0 0 1 4 12a8 8 0 0 1 8.3-8 8 8 0 0 1 8.7 7.5Z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: <path d="m20 20-4.4-4.4m1.4-4.6a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />,
  shield: (
    <path d="M12 3 4.5 6v5.4c0 4.7 3 7.7 7.5 9.6 4.5-1.9 7.5-4.9 7.5-9.6V6L12 3Zm-3 9 2 2 4-4" />
  ),
  sparkles: (
    <path d="m12 3 .8 3.2L16 7l-3.2.8L12 11l-.8-3.2L8 7l3.2-.8L12 3Zm6 10 .5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2ZM5.5 13l.7 2.8L9 16.5l-2.8.7-.7 2.8-.7-2.8-2.8-.7 2.8-.7.7-2.8Z" />
  ),
  user: <path d="M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />,
  users: (
    <path d="M16 21a6 6 0 0 0-12 0m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 10a5 5 0 0 0-3.3-4.7M16 3.3a4 4 0 0 1 0 7.4" />
  ),
  verify: (
    <path d="m12 3 2 2.2 3-.2.8 2.9 2.5 1.7-1.2 2.7.6 2.9-2.7 1.4-1.2 2.7-3-.6L12 21l-2.2-2-3 .6-1.2-2.7-2.7-1.4.6-2.9-1.2-2.7L4.8 8l.8-2.9 3 .2L12 3Zm-3.2 9 2.1 2.1 4.5-4.5" />
  ),
  zap: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
};

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn('icon', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

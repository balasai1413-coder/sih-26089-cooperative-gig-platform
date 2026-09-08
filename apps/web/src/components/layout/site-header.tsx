'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Brand } from '@/components/brand';
import { Icon } from '@/components/icons';
import { GhostButton, IconButton } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';

const links = [
  { href: '#ecosystem', label: 'The ecosystem' },
  { href: '#trust', label: 'Built on trust' },
  { href: '#how-it-works', label: 'How it works' },
];

const roleHome = {
  CUSTOMER: '/dashboard/customer',
  WORKER: '/dashboard/worker',
  COOPERATIVE_ADMIN: '/dashboard/cooperative',
};

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { status, user } = useAuth();
  const workspace = user ? roleHome[user.role] : '/login';
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Brand />
        <nav className="site-nav" aria-label="Main navigation">
          {links.map((link) => (
            <a key={link.href} href={pathname === '/' ? link.href : `/${link.href}`}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="site-header__actions">
          {status !== 'authenticated' ? (
            <GhostButton
              className="header-login"
              onClick={() => {
                window.location.href = '/login';
              }}
            >
              Sign in
            </GhostButton>
          ) : null}
          <Link href={workspace} className="button button--primary button--sm">
            <span>{user ? 'Open workspace' : 'Join sahakar'}</span>
            <Icon name="arrow-right" />
          </Link>
          <IconButton
            label="Open menu"
            icon={menuOpen ? 'close' : 'menu'}
            size="sm"
            className="mobile-menu-button"
            onClick={() => setMenuOpen((open) => !open)}
          />
        </div>
      </div>
      {menuOpen ? (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {links.map((link) => (
            <a
              key={link.href}
              href={pathname === '/' ? link.href : `/${link.href}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link href={workspace} onClick={() => setMenuOpen(false)}>
            {user ? 'Open workspace' : 'Join sahakar'} <Icon name="arrow-right" />
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

'use client';

import { useRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassCard({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('card', 'glass-card', className)} {...props}>
      {children}
    </div>
  );
}

export function PremiumCard({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('card', 'premium-card', className)} {...props}>
      {children}
    </div>
  );
}

export function FeatureCard({ className, children, ...props }: CardProps) {
  return (
    <article className={cn('card', 'feature-card', className)} {...props}>
      {children}
    </article>
  );
}

export function InteractiveCard({ className, children, ...props }: CardProps) {
  const card = useRef<HTMLDivElement>(null);
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !card.current) return;
    const bounds = card.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.current.style.setProperty('--rotate-x', `${-y * 3}deg`);
    card.current.style.setProperty('--rotate-y', `${x * 3}deg`);
    card.current.style.setProperty('--pointer-x', `${(x + 0.5) * 100}%`);
    card.current.style.setProperty('--pointer-y', `${(y + 0.5) * 100}%`);
  }
  function resetTilt() {
    card.current?.style.removeProperty('--rotate-x');
    card.current?.style.removeProperty('--rotate-y');
  }
  return (
    <div
      ref={card}
      className={cn('card', 'interactive-card', className)}
      onPointerMove={onPointerMove}
      onPointerLeave={resetTilt}
      {...props}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  icon?: ReactNode;
  tone?: 'violet' | 'cyan' | 'emerald' | 'amber';
}

export function StatCard({ label, value, change, icon, tone = 'violet' }: StatCardProps) {
  return (
    <InteractiveCard className={cn('stat-card', `stat-card--${tone}`)}>
      <div className="stat-card__head">
        <span>{label}</span>
        {icon ? <span className="stat-card__icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      {change ? <span className="stat-card__change">{change}</span> : null}
    </InteractiveCard>
  );
}

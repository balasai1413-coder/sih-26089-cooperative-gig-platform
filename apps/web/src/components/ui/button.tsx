'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'left',
    className,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('button', `button--${variant}`, `button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="button__spinner" />
      ) : icon && iconPosition === 'left' ? (
        <Icon name={icon} />
      ) : null}
      {children ? <span>{children}</span> : null}
      {!loading && icon && iconPosition === 'right' ? <Icon name={icon} /> : null}
    </button>
  );
});

export const PrimaryButton = Button;

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="ghost" />;
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="danger" />;
}

export function IconButton({
  label,
  ...props
}: Omit<ButtonProps, 'variant' | 'children'> & { label: string }) {
  return <Button {...props} variant="icon" aria-label={label} title={label} />;
}

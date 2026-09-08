'use client';

import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/utils';
import { IconButton } from './button';

export function LoadingSpinner({ label = 'Loading' }: { label?: string }) {
  return <span className="loading-spinner" role="status" aria-label={label} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('skeleton', className)} aria-hidden="true" />;
}

export function EmptyState({
  icon = 'compass',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function ErrorState({
  title = 'A quiet interruption',
  description,
  retry,
}: {
  title?: string;
  description: string;
  retry?: ReactNode;
}) {
  return (
    <section className="empty-state error-state">
      <span className="empty-state__icon">
        <Icon name="close" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {retry}
    </section>
  );
}

export function Toast({
  message,
  tone = 'success',
  onDismiss,
}: {
  message: string;
  tone?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
}) {
  useEffect(() => {
    if (!onDismiss) return;
    const timeout = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);
  return (
    <div className={cn('toast', `toast--${tone}`)} role="status">
      <Icon name={tone === 'error' ? 'close' : tone === 'success' ? 'check' : 'sparkles'} />
      <span>{message}</span>
      {onDismiss ? (
        <IconButton label="Dismiss notification" icon="close" size="sm" onClick={onDismiss} />
      ) : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="modal-title">{title}</h2>
          <IconButton label="Close dialog" icon="close" size="sm" onClick={onClose} />
        </div>
        {children}
      </section>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="modal__description">{description}</p>
      <div className="modal__actions">
        <button className="button button--ghost button--md" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="button button--danger button--md" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

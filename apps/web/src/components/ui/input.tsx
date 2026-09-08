'use client';

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
}

type InputProps = FieldProps & InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { label, error, success, hint, required, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? success ?? hint;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <input
        ref={ref}
        id={inputId}
        className={cn('field__control', error && 'is-error', success && 'is-success', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? `${inputId}-message` : undefined}
        required={required}
        {...props}
      />
      {message ? (
        <span
          id={`${inputId}-message`}
          className={cn('field__message', error && 'is-error', success && 'is-success')}
        >
          {message}
        </span>
      ) : null}
    </label>
  );
});

export function EmailInput(props: Omit<InputProps, 'type'>) {
  return <TextInput {...props} type="email" autoComplete="email" inputMode="email" />;
}

export function MobileInput(props: Omit<InputProps, 'type'>) {
  return (
    <TextInput
      {...props}
      type="tel"
      autoComplete="tel"
      inputMode="tel"
      placeholder="+91 98765 43210"
    />
  );
}

export function PasswordInput({
  label,
  error,
  success,
  hint,
  required,
  className,
  id,
  ...inputProps
}: Omit<InputProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? success ?? hint;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <span className="password-control">
        <input
          {...inputProps}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={cn(
            'field__control',
            'field__control--password',
            error && 'is-error',
            success && 'is-success',
            className,
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? `${inputId}-message` : undefined}
          required={required}
        />
        <button
          className="password-control__toggle"
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} />
        </button>
      </span>
      {message ? (
        <span
          id={`${inputId}-message`}
          className={cn('field__message', error && 'is-error', success && 'is-success')}
        >
          {message}
        </span>
      ) : null}
    </label>
  );
}

export function Select({
  label,
  error,
  success,
  hint,
  required,
  className,
  id,
  children,
  ...props
}: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? success ?? hint;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <span className="select-wrap">
        <select
          id={inputId}
          className={cn(
            'field__control',
            'select-control',
            error && 'is-error',
            success && 'is-success',
            className,
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? `${inputId}-message` : undefined}
          required={required}
          {...props}
        >
          {children}
        </select>
        <Icon name="chevron-down" />
      </span>
      {message ? (
        <span
          id={`${inputId}-message`}
          className={cn('field__message', error && 'is-error', success && 'is-success')}
        >
          {message}
        </span>
      ) : null}
    </label>
  );
}

export function SearchInput({
  label = 'Search',
  ...props
}: Omit<InputProps, 'type' | 'label'> & { label?: string }) {
  return <TextInput {...props} label={label} type="search" />;
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ label, error, success, hint, required, className, id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? success ?? hint;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          'field__control',
          'textarea-control',
          error && 'is-error',
          success && 'is-success',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? `${inputId}-message` : undefined}
        required={required}
        {...props}
      />
      {message ? (
        <span
          id={`${inputId}-message`}
          className={cn('field__message', error && 'is-error', success && 'is-success')}
        >
          {message}
        </span>
      ) : null}
    </label>
  );
});

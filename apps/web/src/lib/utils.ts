import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combines conditional classes safely for future shadcn/ui components. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

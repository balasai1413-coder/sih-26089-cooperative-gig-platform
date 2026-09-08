import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Brand({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <Link href="/" className={cn('brand', inverse && 'brand--inverse')} aria-label="Sahakar home">
      <span className="brand__mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {!compact ? <span className="brand__wordmark">sahakar</span> : null}
    </Link>
  );
}

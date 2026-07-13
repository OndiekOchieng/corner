import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BackLinkProps {
  href: string;
  label?: string;
}

/** Consistent, glove-friendly back affordance shared across secondary screens. */
export function BackLink({ href, label = 'Back' }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 gap-1.5 px-3')}
    >
      <ChevronLeft className="size-4" />
      {label}
    </Link>
  );
}

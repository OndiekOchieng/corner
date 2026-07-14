import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpLinkProps {
  /** Where "up" goes — always an explicit parent (Home, Library). */
  href: string;
  /** The destination, named. Never a generic "Back". */
  label: string;
  className?: string;
}

/**
 * UpLink — the single up-navigation affordance across Corner (hub-and-spoke).
 *
 * Rendered as a quiet **eyebrow** above the page title: subtle, muted, and always
 * naming its destination ("Home", "Library") so navigation reads as moving between
 * training spaces, not browser history. The page title is the hero; this stays out
 * of its way. OS back gestures remain available — this is the visible, accessible
 * counterpart, never the only mechanism.
 *
 * Accessibility: a real link with a descriptive name, a ≥44px touch target, and a
 * visible focus ring.
 */
export function UpLink({ href, label, className }: UpLinkProps) {
  return (
    <Link
      href={href}
      aria-label={`Up to ${label}`}
      className={cn(
        // Quiet eyebrow: small, muted, letter-spaced — deliberately below the title.
        'group inline-flex min-h-11 items-center gap-1.5 rounded-md pr-2 text-sm font-medium tracking-wide',
        'text-muted-foreground transition-colors hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-push',
        className,
      )}
    >
      <ArrowLeft
        className="size-4 transition-transform group-hover:-translate-x-0.5"
        aria-hidden="true"
      />
      {label}
    </Link>
  );
}

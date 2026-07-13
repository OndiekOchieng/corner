import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps extends React.ComponentProps<'main'> {
  /**
   * Content width. `default` is the reading column used by most screens; `wide`
   * is for grid screens (the workout library).
   */
  width?: 'default' | 'wide';
  /** Vertically centre the content — used for loading/error states. */
  center?: boolean;
}

const WIDTHS = {
  default: 'max-w-2xl',
  wide: 'max-w-5xl',
} as const;

/**
 * The single content wrapper for application pages. It provides the app-wide
 * mobile rhythm — comfortable, safe-area-aware side gutters (never edge-to-edge),
 * consistent top/bottom padding, a sensible max-width, and centering on tablets —
 * so no page defines its own margins. Purely presentational; renders a `<main>`.
 */
export function PageContainer({
  width = 'default',
  center = false,
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <main
      className={cn(
        'page-shell mx-auto w-full',
        WIDTHS[width],
        center && 'flex flex-col items-center justify-center',
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
}

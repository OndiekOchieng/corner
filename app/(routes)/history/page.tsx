'use client';

import Link from 'next/link';
import { BackLink } from '@/components/ui/BackLink';
import { PageContainer } from '@/components/ui/PageContainer';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

export default function HistoryPage() {
  return (
    <PageContainer>
      <BackLink href="/" label="Home" />

      <div className="mb-8 mt-6">
        <h1 className="text-4xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-muted-foreground">
          Every session you finish, kept in your corner.
        </p>
      </div>

      {/* Empty state — an invitation to begin, never a scolding blank. */}
      <div className="animate-rise rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10 elevate-1">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary">
          <Flame className="size-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Your first round starts it all</h2>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
          Finish a session and it lands here — your streak, your coaches, and the
          work you&apos;ve put in.
        </p>
        <Link
          href="/workouts"
          className={cn(
            buttonVariants(),
            'mt-6 h-14 rounded-2xl bg-primary px-8 text-base font-semibold',
          )}
        >
          Choose a workout
        </Link>
      </div>
    </PageContainer>
  );
}

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RestScreen } from '@/components/Rest/RestScreen';
import { useTimer } from '@/hooks';

function RestPageContent() {
  const searchParams = useSearchParams();
  const restDuration = parseInt(searchParams.get('restDuration') || '60', 10);
  const nextRoundName = searchParams.get('nextRoundName') || 'Next Round';

  const timer = useTimer(restDuration);

  return (
    <main className="screen mx-auto max-w-2xl px-5 py-10 md:px-8">
      <RestScreen
        remainingSeconds={timer.remainingSeconds}
        nextRoundName={nextRoundName}
      />
    </main>
  );
}

export default function RestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RestPageContent />
    </Suspense>
  );
}

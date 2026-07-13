'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RestScreen } from '@/components/Rest/RestScreen';
import { PageContainer } from '@/components/ui/PageContainer';
import { useTimer } from '@/hooks';

function RestPageContent() {
  const searchParams = useSearchParams();
  const restDuration = parseInt(searchParams.get('restDuration') || '60', 10);
  const nextRoundName = searchParams.get('nextRoundName') || 'Next Round';

  const timer = useTimer(restDuration);

  return (
    <PageContainer center>
      <RestScreen
        remainingSeconds={timer.remainingSeconds}
        nextRoundName={nextRoundName}
      />
    </PageContainer>
  );
}

export default function RestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RestPageContent />
    </Suspense>
  );
}

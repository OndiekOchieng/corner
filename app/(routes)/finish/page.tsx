'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FinishScreen } from '@/components/Finish/FinishScreen';
import { PageContainer } from '@/components/ui/PageContainer';

function FinishPageContent() {
  const searchParams = useSearchParams();
  const workoutName = searchParams.get('workoutName') || 'Workout';
  const duration = parseInt(searchParams.get('duration') || '0', 10);
  const roundsCompleted = parseInt(searchParams.get('roundsCompleted') || '0', 10);
  const totalRounds = parseInt(searchParams.get('totalRounds') || '0', 10);
  const sessionId = searchParams.get('sessionId');

  return (
    <PageContainer>
      <FinishScreen
        workoutName={workoutName}
        duration={duration}
        roundsCompleted={roundsCompleted}
        totalRounds={totalRounds}
        sessionId={sessionId}
      />
    </PageContainer>
  );
}

export default function FinishPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <FinishPageContent />
    </Suspense>
  );
}

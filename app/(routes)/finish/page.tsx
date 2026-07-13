'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FinishScreen } from '@/components/Finish/FinishScreen';

function FinishPageContent() {
  const searchParams = useSearchParams();
  const workoutName = searchParams.get('workoutName') || 'Workout';
  const duration = parseInt(searchParams.get('duration') || '0', 10);
  const roundsCompleted = parseInt(searchParams.get('roundsCompleted') || '0', 10);
  const totalRounds = parseInt(searchParams.get('totalRounds') || '0', 10);

  return (
    <main className="screen mx-auto max-w-2xl px-5 py-10 md:px-8">
      <FinishScreen
        workoutName={workoutName}
        duration={duration}
        roundsCompleted={roundsCompleted}
        totalRounds={totalRounds}
      />
    </main>
  );
}

export default function FinishPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <FinishPageContent />
    </Suspense>
  );
}

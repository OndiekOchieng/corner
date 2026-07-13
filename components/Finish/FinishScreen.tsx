'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { formatDuration } from '@/lib/formatting';
import { createHistoryService } from '@/src/lib/integration';

interface FinishScreenProps {
  workoutName: string;
  duration: number;
  roundsCompleted: number;
  totalRounds: number;
  /** Id of the session the Persistence Subscriber just wrote to History. */
  sessionId?: string | null;
}

export function FinishScreen({
  workoutName,
  duration,
  roundsCompleted,
  totalRounds,
  sessionId,
}: FinishScreenProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const avgRound =
    roundsCompleted > 0
      ? formatDuration(Math.floor(duration / roundsCompleted))
      : '0m';

  // Attach the athlete's rating/notes to the already-persisted session, then go home.
  const handleDone = async () => {
    if (sessionId && (rating != null || notes.trim().length > 0)) {
      setSaving(true);
      try {
        await createHistoryService().rateSession(sessionId, rating, notes.trim() || null);
      } catch {
        /* never block leaving the screen on a storage hiccup */
      }
    }
    router.push('/');
  };

  return (
    <div className="animate-rise space-y-8">
      {/* The honest close — quiet, specific, earned. */}
      <div className="pt-4 text-center">
        <p className="eyebrow mb-3 text-success">Session complete</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
          {workoutName}
        </h1>
        <p className="mt-3 text-muted-foreground">That was honest work. Well done.</p>
      </div>

      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-border ring-1 ring-foreground/10">
        {[
          { label: 'Time', value: formatDuration(duration) },
          { label: 'Rounds', value: `${roundsCompleted}/${totalRounds}` },
          { label: 'Avg round', value: avgRound },
        ].map((stat) => (
          <div key={stat.label} className="bg-card p-5 text-center">
            <dt className="eyebrow mb-1">{stat.label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
        <p className="eyebrow mb-4 text-center">How did that feel?</p>
        <div className="mb-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              aria-label={`Rate ${star} out of 5`}
              aria-pressed={rating === star}
              className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-push"
            >
              <Star
                className={`size-9 transition-colors ${
                  rating && star <= rating
                    ? 'fill-success text-success'
                    : 'text-muted'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything to remember about this session?"
          className="h-24 w-full resize-none rounded-xl bg-input p-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-push"
        />
      </div>

      <Button
        onClick={handleDone}
        disabled={saving}
        className="h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Done
      </Button>
    </div>
  );
}

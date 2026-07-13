import { notFound } from 'next/navigation';
import { SpeechSandbox } from './SpeechSandbox';

// Development-only. Returns 404 in production so it is never reachable on the
// deployed app and never appears in production navigation (nothing links to it).
export default function DevSpeechPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <SpeechSandbox />;
}

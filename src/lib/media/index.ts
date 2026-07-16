/**
 * Media Runtime — public surface (PR-010).
 *
 * The final browser-integration layer. It owns all browser media concerns —
 * AudioContext, Speech API, Wake Lock, capabilities, visibility — so nothing
 * above it ever touches a browser media API. The Coach Runtime renders into the
 * SpeechSink it provides; workout lifecycle events drive bells and the wake lock.
 *
 *   Coach Runtime → Media Runtime → { Speech API, Web Audio, Wake Lock }
 *
 * Wiring:
 *   const media = new MediaRuntime();
 *   media.configureSpeech({ ... }); media.setBellsEnabled(true);
 *   bus.register(createCoachRuntimePlugin({ personality, sink: media.speechSink() }));
 *   bus.register(createMediaRuntimePlugin(media));
 *   // from the Start gesture: void media.unlock();
 */

export {
  CapabilityService,
  resolveCapabilityEnv,
  type CapabilitySnapshot,
  type CapabilityEnv,
} from './CapabilityService';

export {
  AudioManager,
  type AudioManagerOptions,
  type AudioContextLike,
  type AudioContextFactory,
  type AudioBufferLike,
  type AudioBufferSourceLike,
  type BellAssetLoader,
  type BellKind,
} from './AudioManager';

export {
  SpeechManager,
  type SpeechEngine,
  type SpeechSettings,
} from './SpeechManager';

export {
  WakeLockManager,
  type WakeLockApiLike,
  type WakeLockSentinelLike,
  type WakeLockStatus,
  type WakeLockManagerOptions,
} from './WakeLockManager';

export {
  MediaDiagnostics,
  type MediaDiagnosticsSnapshot,
  type VisibilityState,
  type BrowserCompatibility,
} from './MediaDiagnostics';

export {
  MediaRuntime,
  type MediaRuntimeDeps,
  type VisibilityLike,
  type GestureTargetLike,
  type SpeechTraceSnapshot,
} from './MediaRuntime';

export type {
  SpeechServiceStats,
  VoiceInfo,
  VoiceStatus,
  VoiceReadinessDiagnostics,
} from './SpeechManager';

export { primeSpeechFromGesture } from './prime';

export {
  MediaRuntimePlugin,
  createMediaRuntimePlugin,
  MEDIA_RUNTIME_SUBSCRIBER_ID,
} from './MediaRuntimePlugin';

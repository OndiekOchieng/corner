'use client';

/**
 * Browser Speech Sandbox (PR-017A → PR-018)
 * ---------------------------------------------------------------------------
 * A completely isolated test page for the browser's native SpeechSynthesis.
 * ZERO Corner dependencies — no Engine, Event/Coach/Media/Session Runtime, no
 * SpeechService/SpeechManager, no React Context, no workout logic. It touches
 * ONLY `window.speechSynthesis` / `SpeechSynthesisUtterance` and `navigator`.
 *
 * PR-018 expands it into a browser-engine validator: explicit voice selection,
 * default-vs-explicit comparison, localService / browser-language indicators,
 * utterance.lang + rate + pitch + volume selectors, and an automated test matrix
 * that determines whether the failure is tied to the browser DEFAULT VOICE, the
 * SELECTED ENGINE (e.g. Google network voice), or the ANDROID TTS layer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_TEXT =
  'Hello from Corner. If you can hear this, your browser speech engine is functioning correctly.';

const MATRIX_TEXT = 'Test one two three.';
const STALL_TIMEOUT_MS = 5000;

interface LogEntry {
  time: string;
  msg: string;
  kind?: 'start' | 'end' | 'error' | 'info' | 'head';
}

interface Diag {
  userAgent: string;
  browserLang: string;
  browserLangs: string;
  isActive: string;
  hasBeenActive: string;
  pending: boolean;
  speaking: boolean;
  paused: boolean;
  voiceCount: number;
  selectedVoice: string;
  selectedLocal: string;
}

function now(): string {
  return new Date().toLocaleTimeString('en-GB'); // HH:MM:SS
}

function voicesFind(list: SpeechSynthesisVoice[], uri: string): SpeechSynthesisVoice | null {
  if (!uri) return null;
  return list.find((v) => v.voiceURI === uri) ?? null;
}

// A fixed phrase of known length — measuring the same words at the same rate on
// two devices isolates how each platform renders `utterance.rate` (PR-024 rate
// investigation). Corner's default rate is 1.0 (it was 1.2 before PR-024A).
const MEASURE_TEXT =
  'This is a fixed sentence used to measure how fast the coach speaks on this device, so the same rate can be compared fairly across platforms.';
const MEASURE_WORDS = MEASURE_TEXT.trim().split(/\s+/).length;

interface RateResult {
  configuredRate: number;
  actualRate: number;
  voice: string;
  lang: string;
  words: number;
  durationMs: number;
  wpm: number;
}

export function SpeechSandbox() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedURI, setSelectedURI] = useState<string>(''); // '' = browser default
  const [lang, setLang] = useState<string>(''); // '' = utterance default
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [busy, setBusy] = useState(false);
  const [rateResult, setRateResult] = useState<RateResult | null>(null);

  // Refs so the diagnostics poller + async matrix read current values.
  const selURIRef = useRef(selectedURI);
  selURIRef.current = selectedURI;
  const cfgRef = useRef({ text, lang, rate, pitch, volume });
  cfgRef.current = { text, lang, rate, pitch, volume };

  const addLog = useCallback((msg: string, kind: LogEntry['kind'] = 'info') => {
    console.log(`[SpeechSandbox] ${now()} ${msg}`);
    setLog((prev) => [{ time: now(), msg, kind }, ...prev].slice(0, 400));
  }, []);

  // --- Voices ---------------------------------------------------------------
  const loadVoices = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    const list = window.speechSynthesis.getVoices() ?? [];
    setVoices(list);
    return list;
  }, []);

  useEffect(() => {
    loadVoices();
    const synth = window.speechSynthesis;
    if (!synth) return;
    const handler = () => {
      const list = loadVoices();
      addLog(`voiceschanged (${list.length} voices)`);
    };
    synth.addEventListener?.('voiceschanged', handler);
    return () => synth.removeEventListener?.('voiceschanged', handler);
  }, [loadVoices, addLog]);

  // --- Live diagnostics (polled) -------------------------------------------
  useEffect(() => {
    const read = () => {
      if (typeof window === 'undefined') return;
      const synth = window.speechSynthesis;
      const ua = (
        navigator as unknown as {
          userActivation?: { isActive: boolean; hasBeenActive: boolean };
        }
      ).userActivation;
      const sel = voicesFind(synth?.getVoices?.() ?? [], selURIRef.current);
      setDiag({
        userAgent: navigator.userAgent,
        browserLang: navigator.language ?? 'n/a',
        browserLangs: (navigator.languages ?? []).join(', ') || 'n/a',
        isActive: ua ? String(ua.isActive) : 'n/a',
        hasBeenActive: ua ? String(ua.hasBeenActive) : 'n/a',
        pending: !!synth?.pending,
        speaking: !!synth?.speaking,
        paused: !!synth?.paused,
        voiceCount: synth?.getVoices?.().length ?? 0,
        selectedVoice: sel ? `${sel.name} (${sel.lang})` : 'Browser default',
        selectedLocal: sel ? (sel.localService ? 'local (on-device)' : 'network') : 'n/a',
      });
    };
    read();
    const id = window.setInterval(read, 250);
    return () => window.clearInterval(id);
  }, []);

  const snapshot = useCallback(
    (label: string) => {
      const s = window.speechSynthesis;
      addLog(`${label} → pending=${!!s?.pending} speaking=${!!s?.speaking} paused=${!!s?.paused}`);
    },
    [addLog],
  );

  // --- Core speak, promise-based so the matrix can run cases in sequence -----
  // Resolves on end/error, or on a timeout (which is how a SILENT DROP — the
  // Android failure — is detected: speak() returns but onstart never fires).
  const speakCase = useCallback(
    (opts: {
      label: string;
      text: string;
      voice: SpeechSynthesisVoice | null;
      lang: string;
      rate: number;
      pitch: number;
      volume: number;
    }): Promise<string> => {
      return new Promise((resolve) => {
        const s = window.speechSynthesis;
        if (!s || typeof SpeechSynthesisUtterance === 'undefined') {
          addLog(`${opts.label}: speechSynthesis UNAVAILABLE`, 'error');
          resolve('unavailable');
          return;
        }
        const u = new SpeechSynthesisUtterance(opts.text);
        if (opts.voice) u.voice = opts.voice;
        if (opts.lang) u.lang = opts.lang;
        u.rate = opts.rate;
        u.pitch = opts.pitch;
        u.volume = opts.volume;

        const voiceName = opts.voice ? opts.voice.name : 'DEFAULT (none assigned)';
        const local = opts.voice ? (opts.voice.localService ? 'local' : 'network') : 'n/a';
        addLog(
          `▼ ${opts.label} — voice=${voiceName} [${local}] lang=${u.lang || '(default)'} rate=${opts.rate} pitch=${opts.pitch} vol=${opts.volume}`,
          'head',
        );

        let started = false;
        let settled = false;
        let timer = 0;
        const finish = (outcome: string) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(outcome);
        };

        u.onstart = () => {
          started = true;
          addLog(`${opts.label}: START`, 'start');
        };
        u.onend = () => {
          addLog(`${opts.label}: END`, 'end');
          finish('end');
        };
        u.onerror = (e) => {
          addLog(`${opts.label}: ERROR ${(e as SpeechSynthesisErrorEvent).error ?? ''}`.trim(), 'error');
          finish(`error:${(e as SpeechSynthesisErrorEvent).error ?? '?'}`);
        };

        addLog(
          `${opts.label}: BEFORE speak() → pending=${!!s.pending} speaking=${!!s.speaking} paused=${!!s.paused}`,
        );
        s.speak(u);
        addLog(
          `${opts.label}: AFTER speak() → pending=${!!s.pending} speaking=${!!s.speaking} paused=${!!s.paused}`,
        );

        timer = window.setTimeout(() => {
          if (started) {
            addLog(`${opts.label}: STALLED after START (no END in ${STALL_TIMEOUT_MS}ms)`, 'error');
            finish('timeout-after-start');
          } else {
            addLog(
              `${opts.label}: ✗ NO onstart in ${STALL_TIMEOUT_MS}ms — utterance SILENTLY DROPPED (pending=${!!s.pending})`,
              'error',
            );
            s.cancel(); // clear so the next case starts clean
            finish('timeout-no-onstart');
          }
        }, STALL_TIMEOUT_MS);
      });
    },
    [addLog],
  );

  // --- Rate measurement (PR-024) --------------------------------------------
  // Speak a fixed phrase at a chosen rate and time onstart→onend to compute the
  // ACTUAL words-per-minute this device produces. Run @1.0 and @1.2 on desktop and
  // iPhone: identical numeric rate, different WPM ⇒ the platform renders rate
  // differently.
  const measureRate = useCallback(
    (atRate: number) => {
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        addLog('measure: speechSynthesis UNAVAILABLE', 'error');
        return;
      }
      synth.cancel();
      const c = cfgRef.current;
      const voice = voicesFind(synth.getVoices(), selURIRef.current);
      const u = new SpeechSynthesisUtterance(MEASURE_TEXT);
      if (voice) u.voice = voice;
      if (c.lang) u.lang = c.lang;
      u.rate = atRate;
      u.pitch = c.pitch;
      u.volume = c.volume;
      const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      let t0 = 0;
      u.onstart = () => {
        t0 = now();
        addLog(`measure @${atRate}: START (utterance.rate=${u.rate})`, 'start');
      };
      u.onend = () => {
        const durationMs = Math.round(now() - t0);
        const wpm = durationMs > 0 ? Math.round(MEASURE_WORDS / (durationMs / 60000)) : 0;
        setRateResult({
          configuredRate: atRate,
          actualRate: u.rate,
          voice: voice?.name ?? 'browser default',
          lang: u.lang || voice?.lang || '(default)',
          words: MEASURE_WORDS,
          durationMs,
          wpm,
        });
        addLog(`measure @${atRate}: END dur=${durationMs}ms → ${wpm} wpm`, 'end');
      };
      u.onerror = (e) => addLog(`measure @${atRate}: ERROR ${(e as SpeechSynthesisErrorEvent).error ?? ''}`, 'error');
      addLog(`measure @${atRate}: speak() ${MEASURE_WORDS} words, voice=${voice?.name ?? 'default'}`);
      synth.speak(u);
    },
    [addLog],
  );

  // --- Manual buttons -------------------------------------------------------
  const handleSpeak = useCallback(() => {
    const c = cfgRef.current;
    const voice = voicesFind(window.speechSynthesis?.getVoices?.() ?? [], selURIRef.current);
    void speakCase({ label: 'Speak', text: c.text, voice, lang: c.lang, rate: c.rate, pitch: c.pitch, volume: c.volume });
  }, [speakCase]);

  const handleCancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    addLog('cancel() called');
  }, [addLog]);
  const handlePause = useCallback(() => {
    window.speechSynthesis?.pause();
    addLog('pause() called');
  }, [addLog]);
  const handleResume = useCallback(() => {
    window.speechSynthesis?.resume();
    addLog('resume() called');
  }, [addLog]);
  const handleRefreshVoices = useCallback(() => {
    const list = loadVoices();
    addLog(`Refresh Voices → ${list.length} voices`);
  }, [loadVoices, addLog]);

  // --- Default vs Explicit comparison --------------------------------------
  const handleCompare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const list = window.speechSynthesis?.getVoices?.() ?? [];
    const explicit = voicesFind(list, selURIRef.current) ?? list.find((v) => /google/i.test(v.name)) ?? list[0] ?? null;
    addLog('=== DEFAULT vs EXPLICIT ===', 'head');
    await speakCase({ label: 'A/DEFAULT', text: MATRIX_TEXT, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
    await speakCase({ label: 'B/EXPLICIT', text: MATRIX_TEXT, voice: explicit, lang: '', rate: 1, pitch: 1, volume: 1 });
    addLog('=== comparison complete ===', 'head');
    setBusy(false);
  }, [busy, speakCase, addLog]);

  // --- Automated test matrix ------------------------------------------------
  const handleMatrix = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const list = window.speechSynthesis?.getVoices?.() ?? [];
    const base = (navigator.language ?? 'en').slice(0, 2).toLowerCase();
    const googleVoice = list.find((v) => /google/i.test(v.name)) ?? null;
    const foreignVoice = list.find((v) => !v.lang.toLowerCase().startsWith(base)) ?? null;

    addLog(`===== TEST MATRIX (browser default lang=${navigator.language}) =====`, 'head');
    addLog(`voices=${list.length} · google=${googleVoice?.name ?? 'none'} · foreign=${foreignVoice?.name ?? 'none'}`);

    const cases = [
      { label: '1/DEFAULT-VOICE', voice: null as SpeechSynthesisVoice | null, lang: '', rate: 1, pitch: 1, volume: 1 },
      { label: '2/EXPLICIT-GOOGLE', voice: googleVoice, lang: '', rate: 1, pitch: 1, volume: 1 },
      { label: '3/DIFFERENT-LANG', voice: foreignVoice, lang: foreignVoice?.lang ?? 'es-ES', rate: 1, pitch: 1, volume: 1 },
      { label: '4/DIFFERENT-RATE', voice: null, lang: '', rate: 0.6, pitch: 1, volume: 1 },
      { label: '5/DIFFERENT-VOLUME', voice: null, lang: '', rate: 1, pitch: 1, volume: 0.4 },
    ];

    const results: Record<string, string> = {};
    for (const c of cases) {
      // eslint-disable-next-line no-await-in-loop
      results[c.label] = await speakCase({ text: MATRIX_TEXT, ...c });
      // small gap so the engine settles between cases
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => window.setTimeout(r, 400));
    }

    addLog('===== MATRIX SUMMARY =====', 'head');
    for (const c of cases) addLog(`${c.label}: ${results[c.label]}`, results[c.label] === 'end' ? 'end' : 'error');
    // Verdict heuristic
    const ok = (k: string) => results[k] === 'end';
    let verdict: string;
    if (Object.values(results).every((r) => r !== 'end')) {
      verdict = 'ALL cases failed → Android TTS layer / engine is not producing audio at all.';
    } else if (!ok('1/DEFAULT-VOICE') && (ok('2/EXPLICIT-GOOGLE') || ok('3/DIFFERENT-LANG'))) {
      verdict = 'DEFAULT voice fails but an EXPLICIT voice works → failure is tied to the browser DEFAULT voice.';
    } else if (ok('1/DEFAULT-VOICE') && !ok('2/EXPLICIT-GOOGLE')) {
      verdict = 'Default works but the Google/network voice fails → failure is tied to the SELECTED (network) engine.';
    } else {
      verdict = 'Mixed/every case works → engine healthy; failure was integration-specific, not the engine.';
    }
    addLog(`VERDICT: ${verdict}`, 'head');
    setBusy(false);
  }, [busy, speakCase, addLog]);

  // Distinct languages present, for the lang selector.
  const langs = Array.from(new Set(voices.map((v) => v.lang).filter(Boolean))).sort();

  // --- Render ---------------------------------------------------------------
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Browser Speech Sandbox</h1>
        <p style={styles.subtitle}>
          This page tests the browser&apos;s native SpeechSynthesis implementation
          without any Corner infrastructure.
        </p>

        <section style={styles.section}>
          <h2 style={styles.h2}>Diagnostics</h2>
          <dl style={styles.diagGrid}>
            <Row k="Platform" v={diag?.userAgent ?? '…'} mono wrap />
            <Row k="Browser language" v={diag?.browserLang ?? '…'} />
            <Row k="Accepted languages" v={diag?.browserLangs ?? '…'} wrap />
            <Row k="userActivation.isActive" v={diag?.isActive ?? '…'} />
            <Row k="userActivation.hasBeenActive" v={diag?.hasBeenActive ?? '…'} />
            <Row k="speechSynthesis.pending" v={String(diag?.pending ?? '…')} />
            <Row k="speechSynthesis.speaking" v={String(diag?.speaking ?? '…')} />
            <Row k="speechSynthesis.paused" v={String(diag?.paused ?? '…')} />
            <Row k="Number of voices" v={String(diag?.voiceCount ?? '…')} />
            <Row k="Selected voice" v={diag?.selectedVoice ?? '…'} />
            <Row k="Selected localService" v={diag?.selectedLocal ?? '…'} />
          </dl>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Speech rate diagnostics (PR-024)</h2>
          <p style={styles.subtitle}>
            Measures the ACTUAL words-per-minute this device speaks the same phrase.
            Run @1.0 (Corner&apos;s default) and @1.2 (the old default) here and on the other device — same
            numeric rate, different WPM means the platform renders rate differently.
          </p>
          <div style={styles.buttons}>
            <button onClick={() => measureRate(1.0)} style={styles.btn}>
              Measure @ 1.0
            </button>
            <button onClick={() => measureRate(1.2)} style={{ ...styles.btn, ...styles.btnPrimary }}>
              Measure @ 1.2 (old default)
            </button>
            <button onClick={() => measureRate(cfgRef.current.rate)} style={styles.btn}>
              Measure @ slider
            </button>
          </div>
          {rateResult && (
            <dl style={styles.diagGrid}>
              <Row k="Configured rate" v={rateResult.configuredRate.toFixed(2)} />
              <Row k="Actual utterance.rate" v={rateResult.actualRate.toFixed(2)} />
              <Row k="Selected voice" v={rateResult.voice} />
              <Row k="Language" v={rateResult.lang} />
              <Row k="Words" v={String(rateResult.words)} />
              <Row k="Spoken duration" v={`${rateResult.durationMs} ms`} />
              <Row k="Average words/min" v={String(rateResult.wpm)} />
              <Row k="Queue length" v={String(diag?.pending ? '≥ 1' : '0')} />
              <Row k="Speaking" v={String(diag?.speaking ?? false)} />
            </dl>
          )}
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Voice (explicit selection)</h2>
          <select value={selectedURI} onChange={(e) => setSelectedURI(e.target.value)} style={styles.select}>
            <option value="">Browser default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} — {v.lang} [{v.localService ? 'local' : 'network'}]{v.default ? ' ★default' : ''}
              </option>
            ))}
          </select>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Engine parameters</h2>
          <label style={styles.label}>
            utterance.lang
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={styles.select}>
              <option value="">Utterance default</option>
              {langs.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Slider label={`rate · ${rate.toFixed(2)}`} min={0.1} max={2} step={0.1} value={rate} onChange={setRate} />
          <Slider label={`pitch · ${pitch.toFixed(2)}`} min={0} max={2} step={0.1} value={pitch} onChange={setPitch} />
          <Slider label={`volume · ${volume.toFixed(2)}`} min={0} max={1} step={0.1} value={volume} onChange={setVolume} />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Text</h2>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} style={styles.textarea} />
        </section>

        <section style={styles.buttons}>
          <button onClick={handleSpeak} disabled={busy} style={{ ...styles.btn, ...styles.btnPrimary }}>
            Speak
          </button>
          <button onClick={handleCancel} style={styles.btn}>
            Cancel
          </button>
          <button onClick={handlePause} style={styles.btn}>
            Pause
          </button>
          <button onClick={handleResume} style={styles.btn}>
            Resume
          </button>
          <button onClick={handleRefreshVoices} style={styles.btn}>
            Refresh Voices
          </button>
        </section>

        <section style={styles.buttons}>
          <button onClick={handleCompare} disabled={busy} style={{ ...styles.btn, ...styles.btnWide }}>
            Compare: Default vs Explicit
          </button>
          <button onClick={handleMatrix} disabled={busy} style={{ ...styles.btn, ...styles.btnWide, ...styles.btnMatrix }}>
            {busy ? 'Running…' : 'Run Test Matrix'}
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Log</h2>
          <div style={styles.log}>
            {log.length === 0 ? (
              <div style={styles.logEmpty}>No events yet. Tap Speak or Run Test Matrix.</div>
            ) : (
              log.map((e, i) => (
                <div key={i} style={{ ...styles.logLine, ...kindStyle(e.kind) }}>
                  <span style={styles.logTime}>{e.time}</span> {e.msg}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Row({ k, v, mono, wrap }: { k: string; v: string; mono?: boolean; wrap?: boolean }) {
  return (
    <>
      <dt style={styles.dt}>{k}</dt>
      <dd
        style={{
          ...styles.dd,
          fontFamily: mono ? 'ui-monospace, monospace' : undefined,
          wordBreak: wrap ? 'break-all' : undefined,
        }}
      >
        {v}
      </dd>
    </>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label style={styles.label}>
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={styles.range}
      />
    </label>
  );
}

function kindStyle(kind?: LogEntry['kind']): React.CSSProperties {
  switch (kind) {
    case 'start':
      return { color: '#5ac85a' };
    case 'end':
      return { color: '#7ab8ff' };
    case 'error':
      return { color: '#ff6b6b' };
    case 'head':
      return { color: '#e8b84b', fontWeight: 700 };
    default:
      return {};
  }
}

// Inline styles keep this page 100% self-contained (no Corner/Tailwind classes).
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100svh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 16, background: '#0a0a0a', color: '#e5e5e5' },
  card: { width: '100%', maxWidth: 560, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 16, padding: 20, marginTop: 24 },
  title: { fontSize: 24, fontWeight: 700, margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: '#9a9a9a', margin: '0 0 20px', lineHeight: 1.5 },
  section: { marginBottom: 20 },
  h2: { fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7a7a', margin: '0 0 8px' },
  diagGrid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', margin: 0, fontSize: 13 },
  dt: { color: '#8a8a8a' },
  dd: { margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  label: { display: 'block', fontSize: 12, color: '#9a9a9a', marginBottom: 12 },
  select: { width: '100%', marginTop: 4, padding: '10px 12px', background: '#0f0f0f', color: '#e5e5e5', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 14 },
  range: { width: '100%', marginTop: 6, accentColor: '#e5484d' },
  textarea: { width: '100%', padding: 12, background: '#0f0f0f', color: '#e5e5e5', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' },
  buttons: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  btn: { flex: '1 1 auto', minWidth: 96, padding: '12px 14px', background: '#1f1f1f', color: '#e5e5e5', border: '1px solid #333', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  btnPrimary: { background: '#e5484d', borderColor: '#e5484d', color: '#fff', flexBasis: '100%' },
  btnWide: { flexBasis: '100%' },
  btnMatrix: { background: '#2a5a2a', borderColor: '#3a7a3a', color: '#fff' },
  log: { background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8, padding: 10, height: 260, overflowY: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.6 },
  logEmpty: { color: '#5a5a5a' },
  logLine: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  logTime: { color: '#6a9a6a' },
};

// Tutorial drawer: short lessons that load terms, point at panels and check simple goals.

import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { useStore } from './store';
import { LESSONS } from './lessons';

const KEY = 'lambda-studio:tutorial';
interface TutState { open: boolean; lesson: number; step: number; done: Record<string, boolean> }
const saved = ((): Partial<TutState> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } })();

export const useTutorial = create<TutState & { set(p: Partial<TutState>): void }>((set, get) => ({
  open: false, lesson: 0, step: 0, done: {}, ...saved,
  set(p) {
    set(p);
    const { open, lesson, step, done } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ open, lesson, step, done })); } catch { /* ignore */ }
  },
}));

/** `code`, **bold** and paragraphs. */
function Markup({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\n/).map((para, i) => (
        <p key={i}>{para.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, k): ReactNode =>
          part.startsWith('`') ? <code key={k}>{part.slice(1, -1)}</code>
            : part.startsWith('**') ? <b key={k}>{part.slice(2, -2)}</b> : part)}</p>
      ))}
    </>
  );
}

function point(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  el.classList.remove('tut-focus');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('tut-focus');
  setTimeout(() => el.classList.remove('tut-focus'), 2200);
}

/** Closed, the tutorial subscribes to nothing: goals are checked only while it is open. */
export function Tutorial() {
  const open = useTutorial((t) => t.open);
  return open ? <TutorialDrawer /> : null;
}

function TutorialDrawer() {
  const t = useTutorial();
  const st = useStore();
  const lesson = LESSONS[Math.min(t.lesson, LESSONS.length - 1)];
  const step = lesson.steps[Math.min(t.step, lesson.steps.length - 1)];
  const reached = step.goal ? step.goal.check(st) : false;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${lesson.id}:${t.step}`;

  // a step with a goal is done when the goal is reached; a step without one, when it was shown
  const met = step.goal ? reached : true;
  useEffect(() => { if (met && !t.done[key]) t.set({ done: { ...t.done, [key]: true } }); }, [met, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => {
    if (step.load !== undefined) st.setSource(step.load, 'auto');
    if (step.tool) st.setSetting('toolsTab', step.tool);
    if (step.focus) setTimeout(() => point(step.focus!), 50);
    setLoadedKey(key);
  };
  const go = (lessonIdx: number, stepIdx: number) => { t.set({ lesson: lessonIdx, step: stepIdx }); setLoadedKey(null); };
  const next = () => (t.step + 1 < lesson.steps.length ? go(t.lesson, t.step + 1) : t.lesson + 1 < LESSONS.length ? go(t.lesson + 1, 0) : t.set({ open: false }));
  const prev = () => (t.step > 0 ? go(t.lesson, t.step - 1) : t.lesson > 0 ? go(t.lesson - 1, LESSONS[t.lesson - 1].steps.length - 1) : undefined);
  const lessonDone = (i: number) => LESSONS[i].steps.every((_, k) => t.done[`${LESSONS[i].id}:${k}`]);
  const last = t.lesson === LESSONS.length - 1 && t.step === lesson.steps.length - 1;

  return (
    <aside className="tutorial" aria-label="Tutorial">
      <div className="tut-head">
        <h2>Tutorial</h2>
        <select aria-label="Lesson" value={t.lesson} onChange={(e) => go(Number(e.target.value), 0)}>
          {LESSONS.map((l, i) => <option key={l.id} value={i}>{lessonDone(i) ? '✓ ' : ''}{l.title}</option>)}
        </select>
        <button className="close" onClick={() => t.set({ open: false })} aria-label="Close tutorial">✕</button>
      </div>
      <div className="tut-progress" aria-hidden>{lesson.steps.map((_, k) => <span key={k} className={k === t.step ? 'on' : k < t.step ? 'past' : ''} />)}</div>
      <div className="tut-body">
        <Markup text={step.text} />
        {(step.load !== undefined || step.tool || step.focus) && (
          <button className="primary" onClick={load}>{step.load !== undefined ? (loadedKey === key ? 'Load again' : 'Load the example') : 'Show me'}</button>
        )}
        {step.load !== undefined && <pre className="tut-src">{step.load}</pre>}
        {step.goal && (
          <p className={`tut-goal ${reached || t.done[key] ? 'met' : ''}`} aria-live="polite">
            {reached || t.done[key] ? '✓' : '○'} {step.goal.text}
          </p>
        )}
      </div>
      <div className="tut-nav">
        <button onClick={prev} disabled={t.lesson === 0 && t.step === 0}>◀ Back</button>
        <span className="muted">{t.step + 1} / {lesson.steps.length}</span>
        <button className={reached || !step.goal ? 'primary' : ''} onClick={next}>{last ? 'Finish' : 'Next ▶'}</button>
      </div>
    </aside>
  );
}

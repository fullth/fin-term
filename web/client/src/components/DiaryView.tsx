import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  emptyDiaryDraft,
  loadDiaryEntries,
  saveDiaryEntry,
  type BriefEntry,
  type DiaryDraft,
  type DiaryEntries,
  type DiaryStance,
} from '../lib/storage';

interface Props {
  history: BriefEntry[];
}

type SaveStatus = 'idle' | 'dirty' | 'saved' | 'error';

const STANCES: DiaryStance[] = ['관망', '매수 검토', '보유', '축소'];
const TAGS = ['반도체', '금리', '환율', '외국인수급', '비트코인', '알트코인'];
const SAVE_SHORTCUT = /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘S' : 'Ctrl+S';
// localStorage 쓰기가 실패해도 SPA 화면 전환으로 초안이 즉시 사라지지 않게 세션 메모리에 보관한다.
const volatileDrafts = new Map<string, DiaryDraft>();

function toDraft(entries: DiaryEntries, briefId: string): DiaryDraft {
  const pending = volatileDrafts.get(briefId);
  if (pending) return { ...pending, tags: [...pending.tags] };
  const entry = entries[briefId];
  if (!entry) return emptyDiaryDraft();
  return {
    stance: entry.stance,
    thesis: entry.thesis,
    plan: entry.plan,
    invalidation: entry.invalidation,
    tags: entry.tags,
    confidence: entry.confidence,
  };
}

function briefSummary(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*#>]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);
  const summary = lines.find((line) => /^(?:시장\s*)?(?:한\s*줄|요약)\s*[:：]/.test(line)) ?? lines[0] ?? '내용 없음';
  return summary.length > 52 ? `${summary.slice(0, 52)}…` : summary;
}

function formatDate(at: string, withYear = false): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return new Intl.DateTimeFormat('ko-KR', {
    ...(withYear ? { year: 'numeric' as const } : {}),
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function statusText(status: SaveStatus, hasNote: boolean, savedAutomatically: boolean): string {
  if (status === 'dirty') return '● 작성 중 · 자동 저장 대기';
  if (status === 'saved') return savedAutomatically ? '✓ 자동 저장됨' : '✓ 이 브라우저에 저장됨';
  if (status === 'error') return '저장 실패 — 내용을 복사해 두세요';
  return hasNote ? '✓ 저장된 기록' : '변경 사항 없음';
}

export function DiaryView({ history }: Props) {
  const [notes, setNotes] = useState<DiaryEntries>(loadDiaryEntries);
  const notesRef = useRef(notes);
  const entries = useMemo(() => {
    const byId = new Map(history.map((entry) => [entry.id, entry]));
    for (const note of Object.values(notes)) {
      if (!byId.has(note.brief_id)) {
        byId.set(note.brief_id, { id: note.brief_id, at: note.brief_at, text: note.brief_text });
      }
    }
    return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at));
  }, [history, notes]);
  const [selectedId, setSelectedId] = useState<string | null>(() => entries[0]?.id ?? null);
  const [draft, setDraft] = useState<DiaryDraft>(emptyDiaryDraft);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAutomatically, setSavedAutomatically] = useState(false);
  const selectedRef = useRef<BriefEntry | null>(null);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const autosaveRef = useRef<number | null>(null);
  const loadedIdRef = useRef<string | null>(null);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const selectedHasNote = selected ? Boolean(notes[selected.id]) : false;

  const clearAutosave = useCallback(() => {
    if (autosaveRef.current !== null) window.clearTimeout(autosaveRef.current);
    autosaveRef.current = null;
  }, []);

  const persistDraft = useCallback(
    (brief: BriefEntry | null, snapshot: DiaryDraft, mode: 'auto' | 'manual' | 'switch' = 'manual') => {
      clearAutosave();
      if (!brief) return true;
      const result = saveDiaryEntry(brief, snapshot);
      if (!result.saved) {
        setSaveStatus('error');
        return false;
      }
      notesRef.current = result.entries;
      setNotes(result.entries);
      dirtyRef.current = false;
      volatileDrafts.delete(brief.id);
      setSavedAutomatically(mode === 'auto');
      setSaveStatus(mode === 'switch' ? 'idle' : 'saved');
      return true;
    },
    [clearAutosave],
  );

  const flushPending = useCallback(
    (mode: 'manual' | 'switch' = 'manual') => {
      if (!dirtyRef.current && mode === 'switch') return true;
      return persistDraft(selectedRef.current, draftRef.current, mode);
    },
    [persistDraft],
  );

  const selectEntry = useCallback(
    (nextId: string) => {
      if (nextId === selectedRef.current?.id) return true;
      if (!flushPending('switch')) return false;
      setSelectedId(nextId);
      return true;
    },
    [flushPending],
  );

  const updateDraft = useCallback(
    (updater: (current: DiaryDraft) => DiaryDraft) => {
      const next = updater(draftRef.current);
      draftRef.current = next;
      setDraft(next);
      dirtyRef.current = true;
      setSaveStatus('dirty');
      clearAutosave();
      const target = selectedRef.current;
      if (target) volatileDrafts.set(target.id, next);
      autosaveRef.current = window.setTimeout(() => {
        persistDraft(target, next, 'auto');
      }, 500);
    },
    [clearAutosave, persistDraft],
  );

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (!entries.length) {
      selectedRef.current = null;
      loadedIdRef.current = null;
      setSelectedId(null);
      return;
    }
    if (!selectedId || !entries.some((entry) => entry.id === selectedId)) setSelectedId(entries[0].id);
  }, [entries, selectedId]);

  useLayoutEffect(() => {
    if (!selected) return;
    selectedRef.current = selected;
    if (loadedIdRef.current === selected.id) return;
    loadedIdRef.current = selected.id;
    const hasVolatileDraft = volatileDrafts.has(selected.id);
    const next = toDraft(notesRef.current, selected.id);
    draftRef.current = next;
    setDraft(next);
    dirtyRef.current = hasVolatileDraft;
    clearAutosave();
    setSavedAutomatically(false);
    setSaveStatus(hasVolatileDraft ? 'error' : 'idle');
  }, [clearAutosave, selected]);

  useEffect(() => {
    const savePendingWithoutUi = () => {
      if (!dirtyRef.current || !selectedRef.current) return true;
      const result = saveDiaryEntry(selectedRef.current, draftRef.current);
      if (result.saved) {
        dirtyRef.current = false;
        volatileDrafts.delete(selectedRef.current.id);
      } else {
        volatileDrafts.set(selectedRef.current.id, draftRef.current);
      }
      return result.saved;
    };
    const warnIfUnsaved = (event: BeforeUnloadEvent) => {
      if (savePendingWithoutUi()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnIfUnsaved);
    window.addEventListener('pagehide', savePendingWithoutUi);
    return () => {
      window.removeEventListener('beforeunload', warnIfUnsaved);
      window.removeEventListener('pagehide', savePendingWithoutUi);
      clearAutosave();
      savePendingWithoutUi();
    };
  }, [clearAutosave]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        flushPending('manual');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flushPending]);

  const onHistoryKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || !entries.length) return;
    event.preventDefault();
    const current = Math.max(0, entries.findIndex((entry) => entry.id === selectedId));
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? entries.length - 1
        : event.key === 'ArrowDown'
          ? Math.min(current + 1, entries.length - 1)
          : Math.max(current - 1, 0);
    if (selectEntry(entries[nextIndex].id)) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`[data-diary-id="${CSS.escape(entries[nextIndex].id)}"]`)?.focus();
      });
    }
  };

  const exportNotes = () => {
    const saved = Object.values(notesRef.current).sort((a, b) => b.brief_at.localeCompare(a.brief_at));
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fin-term-diary-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!entries.length) {
    return (
      <main className="diary-main diary-empty">
        <div className="diary-empty-box">
          <span className="diary-eyebrow">market log</span>
          <h1>아직 공개된 브리핑이 없습니다</h1>
          <p>브리핑은 매일 오전 7시에 공개됩니다. 공개되면 여기에서 내 판단을 함께 기록할 수 있습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="diary-main">
      <header className="diary-hero">
        <div>
          <h1>MARKET <span>LOG</span> / AI가 본 시장과 내가 내린 판단</h1>
          <p>브리핑을 고르고, 그날의 생각과 계획, 생각을 바꿀 조건을 함께 남깁니다.</p>
        </div>
        <div className="diary-hero-actions">
          <span className="diary-local-badge">이 브라우저에만 저장</span>
          <button type="button" className="mode-btn" onClick={exportNotes} disabled={!Object.keys(notes).length} title="작성한 기록을 JSON 파일로 내려받기">
            기록 내보내기
          </button>
        </div>
      </header>

      <section className="diary-workspace" aria-label="투자 일지">
        <aside className="diary-panel diary-history">
          <div className="diary-panel-head">
            <div>
              <span className="diary-eyebrow">brief archive</span>
              <strong>브리핑 이력</strong>
            </div>
            <span className="diary-count">{entries.length}건</span>
          </div>
          <div className="diary-history-list" onKeyDown={onHistoryKeyDown}>
            {entries.map((entry) => {
              const hasNote = Boolean(notes[entry.id]);
              return (
                <button
                  type="button"
                  className={`diary-history-item${hasNote ? ' has-note' : ''}`}
                  key={entry.id}
                  data-diary-id={entry.id}
                  aria-current={entry.id === selectedId ? 'true' : undefined}
                  aria-label={`${formatDate(entry.at, true)}, ${briefSummary(entry.text)}, ${hasNote ? '기록 있음' : '미작성'}`}
                  onClick={() => selectEntry(entry.id)}
                >
                  <span className="diary-marker" aria-hidden="true" />
                  <span className="diary-history-copy">
                    <time dateTime={entry.at}>{formatDate(entry.at)}</time>
                    <span className="diary-history-summary">{briefSummary(entry.text)}</span>
                    <span className="diary-history-status">{hasNote ? '● 기록 있음' : '○ 아직 미작성'}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="diary-history-foot"><span>●</span> 기록 있음 · ○ 미작성<br />기록은 해당 날짜의 브리핑에 연결됩니다</div>
        </aside>

        <article className="diary-panel diary-brief-pane">
          <div className="diary-panel-head">
            <div>
              <span className="diary-eyebrow">ai market brief</span>
              <strong>{selected ? formatDate(selected.at, true) : 'BRIEF'}</strong>
            </div>
          </div>
          <div className="diary-brief-meta">
            <div><span>공개 시각</span><strong>{selected ? formatDate(selected.at, true) : '—'}</strong></div>
            <div><span>분량</span><strong>{selected ? `${selected.text.length.toLocaleString('ko-KR')}자` : '—'}</strong></div>
            <div><span>내 기록</span><strong>{selectedHasNote ? '기록됨' : '미작성'}</strong></div>
          </div>
          <div className="diary-brief-scroll">
            <div className="diary-brief-document">
              <span className="diary-brief-label">[AI 브리핑 원문 · 투자 권유 아님]</span>
              <pre>{selected?.text}</pre>
            </div>
          </div>
        </article>

        <aside className="diary-panel diary-journal">
          <div className="diary-panel-head">
            <div>
              <span className="diary-eyebrow">my investment log</span>
              <strong>나의 판단</strong>
            </div>
            <span
              className={`diary-save-state ${saveStatus}`}
              role={saveStatus === 'error' ? 'alert' : 'status'}
              aria-live={saveStatus === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              {statusText(saveStatus, selectedHasNote, savedAutomatically)}
            </span>
          </div>

          <form className="diary-form" onSubmit={(event) => { event.preventDefault(); flushPending('manual'); }}>
            <fieldset className="diary-fieldset">
              <legend>01 / 현재 판단</legend>
              <div className="diary-stance">
                {STANCES.map((stance) => (
                  <button
                    type="button"
                    key={stance}
                    aria-pressed={draft.stance === stance}
                    onClick={() => updateDraft((current) => ({ ...current, stance }))}
                  >
                    {stance}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="diary-field">
              <span>02 / 내 해석 <small>AI 요약에 대한 동의·반박</small></span>
              <textarea
                name="diary-thesis"
                autoComplete="off"
                value={draft.thesis}
                maxLength={3000}
                onChange={(event) => updateDraft((current) => ({ ...current, thesis: event.target.value }))}
                placeholder="예: 반도체 강세를 시장 전체 추세 전환으로 단정하지 않는다."
              />
            </label>

            <label className="diary-field">
              <span>03 / 실행 계획 <small>가격보다 행동을 기록</small></span>
              <textarea
                name="diary-plan"
                autoComplete="off"
                value={draft.plan}
                maxLength={3000}
                onChange={(event) => updateDraft((current) => ({ ...current, plan: event.target.value }))}
                placeholder="예: 급등 추격 없이 3% 이상 조정 시에만 재검토."
              />
            </label>

            <label className="diary-field">
              <span>04 / 생각을 바꿀 조건 <small>이 판단이 틀렸다고 볼 기준</small></span>
              <input
                type="text"
                name="diary-invalidation"
                autoComplete="off"
                value={draft.invalidation}
                maxLength={1000}
                onChange={(event) => updateDraft((current) => ({ ...current, invalidation: event.target.value }))}
                placeholder="예: 금리 재상승 + 거래량 감소가 동시에 발생"
              />
            </label>

            <fieldset className="diary-fieldset">
              <legend>05 / 태그</legend>
              <div className="diary-tags">
                {TAGS.map((tag) => {
                  const active = draft.tags.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      aria-pressed={active}
                      onClick={() => updateDraft((current) => ({
                        ...current,
                        tags: active ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
                      }))}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="diary-field" htmlFor="diary-confidence">
              <span>06 / 확신도 <small>나중에 내 판단을 돌아볼 때 쓰는 값</small></span>
              <span className="diary-confidence-row">
                <input
                  id="diary-confidence"
                  type="range"
                  name="diary-confidence"
                  min="0"
                  max="100"
                  step="5"
                  value={draft.confidence}
                  onChange={(event) => updateDraft((current) => ({ ...current, confidence: Number(event.target.value) }))}
                  aria-describedby="diary-confidence-value"
                />
                <output id="diary-confidence-value" htmlFor="diary-confidence">{draft.confidence}%</output>
              </span>
            </label>

            <div className="diary-actions">
              <span>입력하면 이 브라우저에 자동 저장됩니다.</span>
              <button type="submit" className="diary-primary-btn">기록 저장 <kbd>{SAVE_SHORTCUT}</kbd></button>
            </div>
          </form>
        </aside>
      </section>

      <footer className="diary-footer">
        <span>기록은 서버로 보내지 않습니다. 브라우저 데이터를 지우기 전에 내보내기로 보관하세요.</span>
        <span><kbd>↑↓</kbd> 이력 이동 · <kbd>{SAVE_SHORTCUT}</kbd> 기록 저장</span>
      </footer>
    </main>
  );
}

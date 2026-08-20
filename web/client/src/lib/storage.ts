// 영속 — TUI 의 fs persist 를 localStorage 로 대체. 주식 watchlist + 코인 목록 모두 저장.
import type { NewsScope, CoinMeta } from './types';

const KEY = 'fin-term:state';

export type MarketMode = 'combined' | 'stock' | 'crypto';

const DEFAULT_COINS: CoinMeta[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', upbitMarket: 'KRW-BTC' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', upbitMarket: 'KRW-ETH' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple', upbitMarket: 'KRW-XRP' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', upbitMarket: 'KRW-BCH' },
];

interface Persisted {
  watchlist: string[];
  names: Record<string, string>;
  scope: NewsScope;
  coins: CoinMeta[];
  marketMode: MarketMode;
  terminal: boolean; // 터미널 모드 on/off — 새로고침에도 유지
}

const DEFAULT: Persisted = {
  watchlist: ['AAPL', 'TSLA', 'NVDA', 'MSFT'],
  names: { AAPL: 'Apple', TSLA: 'Tesla', NVDA: 'NVIDIA', MSFT: 'Microsoft' },
  scope: 'domestic',
  coins: DEFAULT_COINS,
  marketMode: 'combined',
  terminal: false,
};

function isMarketMode(value: unknown): value is MarketMode {
  return value === 'combined' || value === 'stock' || value === 'crypto';
}

export function loadPersisted(): Persisted {
  try {
    // 구 키(fin-term:watchlist) 마이그레이션 겸 신 키 우선
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem('fin-term:watchlist');
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      watchlist: p.watchlist?.length ? p.watchlist : DEFAULT.watchlist,
      names: p.names ?? DEFAULT.names,
      scope: p.scope ?? DEFAULT.scope,
      coins: p.coins?.length ? p.coins : DEFAULT.coins,
      marketMode: isMarketMode(p.marketMode) ? p.marketMode : DEFAULT.marketMode,
      terminal: p.terminal === true,
    };
  } catch {
    return DEFAULT;
  }
}

export function savePersisted(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota 등 무시 */
  }
}

// 데일리 브리핑 — 마지막 생성 결과를 별도 키에 보관해 새로고침 후 복원한다.
const BRIEF_KEY = 'fin-term:brief';
// 브리핑 히스토리 — 생성한 브리핑들을 시각과 함께 누적. Diary에서 장기 조회한다.
const BRIEF_HISTORY_KEY = 'fin-term:brief-history';
const BRIEF_HISTORY_MAX = 100;
const DIARY_KEY = 'fin-term:diary:v1';

export interface BriefEntry {
  id: string;
  text: string;
  at: string; // ISO 생성 시각
}

export type DiaryStance = '관망' | '매수 검토' | '보유' | '축소';

export interface DiaryDraft {
  stance: DiaryStance;
  thesis: string;
  plan: string;
  invalidation: string;
  tags: string[];
  confidence: number;
}

export interface DiaryEntry extends DiaryDraft {
  brief_id: string;
  brief_at: string;
  brief_text: string;
  updated_at: string;
}

export type DiaryEntries = Record<string, DiaryEntry>;

const DIARY_STANCES: DiaryStance[] = ['관망', '매수 검토', '보유', '축소'];

export function emptyDiaryDraft(): DiaryDraft {
  return { stance: '관망', thesis: '', plan: '', invalidation: '', tags: [], confidence: 50 };
}

export function loadStoredBrief(): string | null {
  try {
    const raw = localStorage.getItem(BRIEF_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as { text?: string | null };
    return b.text ?? null;
  } catch {
    return null;
  }
}

export function saveStoredBrief(text: string, savedAt = new Date().toISOString()): boolean {
  try {
    localStorage.setItem(BRIEF_KEY, JSON.stringify({ text, savedAt }));
    return true;
  } catch {
    return false;
  }
}

// 히스토리 로드 — 최신순 배열.
export function loadBriefHistory(): BriefEntry[] {
  try {
    const raw = localStorage.getItem(BRIEF_HISTORY_KEY);
    let parsed: unknown = [];
    try {
      parsed = raw ? (JSON.parse(raw) as unknown) : [];
    } catch {
      // 손상된 history가 있더라도 마지막 브리핑은 아래에서 복구한다.
    }
    const arr = Array.isArray(parsed) ? parsed : [];
    const normalized = arr
      .map((value) => normalizeBriefEntry(value))
      .filter((value): value is BriefEntry => value !== null);
    const latest = loadLatestBriefEntry();
    if (latest && !normalized.some((entry) => isSameBrief(entry, latest))) normalized.unshift(latest);
    normalized.sort((a, b) => b.at.localeCompare(a.at));
    normalized.splice(BRIEF_HISTORY_MAX);
    if (JSON.stringify(arr) !== JSON.stringify(normalized)) {
      try {
        localStorage.setItem(BRIEF_HISTORY_KEY, JSON.stringify(normalized));
      } catch {
        // 읽기는 성공했으므로 마이그레이션 write-back 실패가 조회까지 막지는 않게 한다.
      }
    }
    return normalized;
  } catch {
    return [];
  }
}

// 새 브리핑을 히스토리 맨 앞에 추가(최근 N개 유지)하고, 갱신된 배열을 반환.
export function appendBriefHistory(text: string, at: string): { history: BriefEntry[]; saved: boolean } {
  try {
    const entry = { id: `brief:${at}`, text, at };
    const next = [entry, ...loadBriefHistory().filter((item) => item.id !== entry.id)].slice(0, BRIEF_HISTORY_MAX);
    localStorage.setItem(BRIEF_HISTORY_KEY, JSON.stringify(next));
    return { history: next, saved: true };
  } catch {
    return { history: loadBriefHistory(), saved: false };
  }
}

export function loadDiaryEntries(): DiaryEntries {
  try {
    const raw = localStorage.getItem(DIARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const normalized: DiaryEntries = {};
    for (const [briefId, value] of Object.entries(parsed)) {
      const entry = normalizeDiaryEntry(briefId, value);
      if (entry) normalized[entry.brief_id] = entry;
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveDiaryEntry(brief: BriefEntry, draft: DiaryDraft): { entries: DiaryEntries; saved: boolean } {
  const entries = loadDiaryEntries();
  const next: DiaryEntries = {
    ...entries,
    [brief.id]: {
      brief_id: brief.id,
      brief_at: brief.at,
      brief_text: brief.text,
      stance: DIARY_STANCES.includes(draft.stance) ? draft.stance : '관망',
      thesis: draft.thesis,
      plan: draft.plan,
      invalidation: draft.invalidation,
      tags: [...new Set(draft.tags.filter(Boolean))].slice(0, 12),
      confidence: clampConfidence(draft.confidence),
      updated_at: new Date().toISOString(),
    },
  };
  try {
    localStorage.setItem(DIARY_KEY, JSON.stringify(next));
    return { entries: next, saved: true };
  } catch {
    return { entries, saved: false };
  }
}

function normalizeBriefEntry(value: unknown): BriefEntry | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<BriefEntry>;
  if (typeof entry.text !== 'string' || typeof entry.at !== 'string') return null;
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : `brief:${entry.at}`,
    text: entry.text,
    at: entry.at,
  };
}

function loadLatestBriefEntry(): BriefEntry | null {
  try {
    const raw = localStorage.getItem(BRIEF_KEY);
    if (!raw) return null;
    const latest = JSON.parse(raw) as { text?: unknown; savedAt?: unknown };
    if (typeof latest.text !== 'string' || typeof latest.savedAt !== 'string') return null;
    return { id: `brief:${latest.savedAt}`, text: latest.text, at: latest.savedAt };
  } catch {
    return null;
  }
}

function isSameBrief(left: BriefEntry, right: BriefEntry): boolean {
  if (left.id === right.id) return true;
  if (left.text !== right.text) return false;
  const distance = Math.abs(new Date(left.at).getTime() - new Date(right.at).getTime());
  return Number.isFinite(distance) && distance < 5_000;
}

function normalizeDiaryEntry(briefId: string, value: unknown): DiaryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<DiaryEntry>;
  if (typeof entry.brief_text !== 'string' || typeof entry.brief_at !== 'string') return null;
  const stance = DIARY_STANCES.includes(entry.stance as DiaryStance) ? (entry.stance as DiaryStance) : '관망';
  return {
    brief_id: briefId,
    brief_at: entry.brief_at,
    brief_text: entry.brief_text,
    stance,
    thesis: typeof entry.thesis === 'string' ? entry.thesis : '',
    plan: typeof entry.plan === 'string' ? entry.plan : '',
    invalidation: typeof entry.invalidation === 'string' ? entry.invalidation : '',
    tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12) : [],
    confidence: clampConfidence(entry.confidence),
    updated_at: typeof entry.updated_at === 'string' ? entry.updated_at : entry.brief_at,
  };
}

function clampConfidence(value: unknown): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 50;
  return Math.min(100, Math.max(0, Math.round(number / 5) * 5));
}

export type { Persisted };
export { DEFAULT_COINS };

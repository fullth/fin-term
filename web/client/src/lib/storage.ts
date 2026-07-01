// 영속 — TUI 의 fs persist 를 localStorage 로 대체. 주식 watchlist + 코인 목록 모두 저장.
import type { NewsScope, CoinMeta } from './types';

const KEY = 'fin-term:state';

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
  theme: 'dark' | 'light';
  terminal: boolean; // 터미널 모드 on/off — 새로고침에도 유지
}

const DEFAULT: Persisted = {
  watchlist: ['AAPL', 'TSLA', 'NVDA', 'MSFT'],
  names: { AAPL: 'Apple', TSLA: 'Tesla', NVDA: 'NVIDIA', MSFT: 'Microsoft' },
  scope: 'domestic',
  coins: DEFAULT_COINS,
  theme: 'dark',
  terminal: true,
};

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
      theme: p.theme === 'light' ? 'light' : 'dark',
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
// 브리핑 히스토리 — 생성한 브리핑들을 시각과 함께 누적(최근 N개). 모달 탭 조회 + 추후 리포트 생성용.
const BRIEF_HISTORY_KEY = 'fin-term:brief-history';
const BRIEF_HISTORY_MAX = 10;

export interface BriefEntry {
  text: string;
  at: string; // ISO 생성 시각
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

export function saveStoredBrief(text: string): void {
  try {
    localStorage.setItem(BRIEF_KEY, JSON.stringify({ text, savedAt: new Date().toISOString() }));
  } catch {
    /* quota 등 무시 */
  }
}

// 히스토리 로드 — 최신순 배열.
export function loadBriefHistory(): BriefEntry[] {
  try {
    const raw = localStorage.getItem(BRIEF_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as BriefEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// 새 브리핑을 히스토리 맨 앞에 추가(최근 N개 유지)하고, 갱신된 배열을 반환.
export function appendBriefHistory(text: string, at: string): BriefEntry[] {
  try {
    const next = [{ text, at }, ...loadBriefHistory()].slice(0, BRIEF_HISTORY_MAX);
    localStorage.setItem(BRIEF_HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadBriefHistory();
  }
}

export type { Persisted };
export { DEFAULT_COINS };

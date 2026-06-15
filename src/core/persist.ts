// 관심종목 영속화. ~/.fin-term/watchlist.json 에 심볼 목록과 종목명을 저장/로드한다.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = join(homedir(), '.fin-term');
const FILE = join(DIR, 'watchlist.json');

export interface PersistedWatchlist {
  watchlist: string[];
  names: Record<string, string>; // symbol → 회사명
}

export function loadWatchlist(): PersistedWatchlist | null {
  try {
    const raw = readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw) as Partial<PersistedWatchlist>;
    if (!Array.isArray(data.watchlist)) return null;
    return {
      watchlist: data.watchlist.filter((s): s is string => typeof s === 'string'),
      names: data.names && typeof data.names === 'object' ? data.names : {},
    };
  } catch {
    return null; // 파일 없거나 손상 → 기본값 사용
  }
}

export function saveWatchlist(data: PersistedWatchlist): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // 저장 실패는 치명적이지 않음 (다음 실행에 영속만 안 됨)
  }
}

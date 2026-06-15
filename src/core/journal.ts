// 예측 일지 영속. ~/.fin-term/journal.json 에 예측 기록을 저장/로드한다.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = join(homedir(), '.fin-term');
const FILE = join(DIR, 'journal.json');

export interface JournalEntry {
  id: string; // 고유 키
  symbol: string;
  direction: 'up' | 'down';
  reason: string; // 예측 근거
  price_at: number | null; // 예측 당시 가격
  created_at: number; // epoch ms
  feedback?: string; // Claude 근거 평가 (있으면)
}

export function loadJournal(): JournalEntry[] {
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? (data as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveJournal(entries: JournalEntry[]): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch {
    // 저장 실패는 치명적이지 않음
  }
}

// id 생성 (시각 기반 — Math.random/Date.now 직접 쓰되 워크플로 무관 런타임 코드라 허용).
export function newEntry(
  symbol: string,
  direction: 'up' | 'down',
  reason: string,
  priceAt: number | null,
  now: number,
): JournalEntry {
  return {
    id: `${now}-${symbol}`,
    symbol: symbol.toUpperCase(),
    direction,
    reason,
    price_at: priceAt,
    created_at: now,
  };
}

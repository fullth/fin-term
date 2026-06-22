// AI 키 localStorage 관리. 키는 브라우저에만 보관, AI 요청 시 X-AI-Key 헤더로 전송.
// Anthropic 키 자체엔 만료가 없지만, 사용자가 직접 보관 만료일을 두어 주기적 재확인을 유도한다.
const KEY = 'fin-term:ai-key';
const DEFAULT_TTL_DAYS = 30;

interface StoredKey {
  key: string;
  savedAt: number;
  expiresAt: number; // epoch ms — 이 시점 지나면 만료로 간주(재입력 유도)
}

export function loadAiKey(): StoredKey | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredKey;
    if (!s.key) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveAiKey(key: string, ttlDays = DEFAULT_TTL_DAYS): StoredKey {
  const now = Date.now();
  const stored: StoredKey = {
    key: key.trim(),
    savedAt: now,
    expiresAt: now + ttlDays * 86_400_000,
  };
  localStorage.setItem(KEY, JSON.stringify(stored));
  return stored;
}

export function clearAiKey(): void {
  localStorage.removeItem(KEY);
}

// 유효한(미만료) 키 문자열만 반환. 없거나 만료면 null.
export function activeAiKey(): string | null {
  const s = loadAiKey();
  if (!s) return null;
  if (Date.now() > s.expiresAt) return null;
  return s.key;
}

export function isExpired(s: StoredKey | null): boolean {
  return !!s && Date.now() > s.expiresAt;
}

// 만료까지 남은 일수 (음수면 이미 만료). 표시용.
export function daysLeft(s: StoredKey): number {
  return Math.ceil((s.expiresAt - Date.now()) / 86_400_000);
}

// 키 마스킹 표시 (sk-ant-...abcd)
export function maskKey(key: string): string {
  if (key.length <= 12) return '••••';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export function fmtDate(epoch: number): string {
  return new Date(epoch).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export type { StoredKey };

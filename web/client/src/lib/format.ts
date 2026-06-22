// 표시용 포맷 헬퍼 — 루트 src/ui/format.ts 의 표기 로직과 동일.
// 차이: changeColor 는 ink color 대신 CSS 클래스명을 반환, 스파크라인은 SVG 컴포넌트로 별도 처리.

export function fmtPrice(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPriceCompact(n: number | null): string {
  if (n == null) return '—';
  const digits = Math.abs(n) >= 1000 ? 0 : 2;
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtBig(n: number | null): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtChange(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}`;
}

export function arrow(n: number | null): string {
  if (n == null || n === 0) return '';
  return n > 0 ? '▲' : '▼';
}

// 양수=up, 음수=down, 0/null=dim. CSS 클래스명 반환.
export function changeClass(n: number | null): string {
  if (n == null || n === 0) return 'dim';
  return n > 0 ? 'up' : 'down';
}

export function fmtTime(epoch: number): string {
  const d = new Date(epoch);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

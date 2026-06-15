// 표시용 포맷 헬퍼.

const SPARK_CHARS = '▁▂▃▄▅▆▇█';

export function fmtPrice(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// watchlist 등 좁은 칸용 컴팩트 가격. 큰 값(한국 종목 등)은 소수점 생략해 자릿수 절약.
export function fmtPriceCompact(n: number | null): string {
  if (n == null) return '—';
  const digits = Math.abs(n) >= 1000 ? 0 : 2;
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// 큰 수를 K/M/B/T 로 약식 표기 (거래량·시총용).
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
  if (n == null || n === 0) return ' ';
  return n > 0 ? '▲' : '▼';
}

// 양수=green, 음수=red, 0/null=gray. ink color 이름 반환.
export function changeColor(n: number | null): string {
  if (n == null || n === 0) return 'gray';
  return n > 0 ? 'green' : 'red';
}

export function sparkline(values: number[], width = 24): string {
  if (values.length < 2) return '';
  const slice = values.slice(-width);
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const range = max - min || 1;
  return slice
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[idx];
    })
    .join('');
}

export function fmtTime(epoch: number): string {
  const d = new Date(epoch);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// 인쇄 가능한 문자만 통과 (제어문자/이스케이프 시퀀스 거부). 한글 등 멀티바이트는 허용.
// 마우스 휠/클릭의 SGR 이스케이프 시퀀스가 텍스트 입력으로 흘러드는 것을 막는 데 쓴다.
export function isPrintable(s: string): boolean {
  if (!s) return false;
  for (const c of s) {
    const n = c.codePointAt(0) ?? 0;
    if (n < 0x20 || n === 0x7f) return false;
  }
  return true;
}

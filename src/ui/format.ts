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

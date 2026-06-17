// 코인 보유 내역 로드 + 평가/손익/수익률 스냅샷 계산.
// ~/.fin-term/holdings.json 에서 읽는다. 파일 없으면 빈 배열 (코인 기능 비활성).
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { CryptoTickerMap, Holding, HoldingSnapshot } from './types.js';

const FILE = join(homedir(), '.fin-term', 'holdings.json');

// 외부 파일 페이로드(snake_case, 일부 누락 허용) → 내부 Holding 모델.
function toHolding(raw: any): Holding | null {
  if (!raw || typeof raw.id !== 'string') return null;
  const quantity = Number(raw.quantity) || 0;
  const avg_buy_krw = Number(raw.avg_buy_krw ?? raw.avgBuyKrw) || 0;
  const buy_amount_krw = Number(raw.buy_amount_krw ?? raw.buyAmountKrw) || quantity * avg_buy_krw;
  return {
    id: raw.id,
    symbol: String(raw.symbol ?? raw.id).toUpperCase(),
    quantity,
    avg_buy_krw,
    buy_amount_krw,
  };
}

export function loadHoldings(): Holding[] {
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'));
    if (!Array.isArray(raw)) return [];
    return raw.map(toHolding).filter((h): h is Holding => h !== null);
  } catch {
    return []; // 파일 없거나 손상 → 코인 보유 패널 숨김
  }
}

export const HOLDINGS_PATH = FILE;

// 보유 1건 + 현재가 → 스냅샷. 현재가 없으면 null.
export function snapshot(holding: Holding, priceKrw: number | undefined): HoldingSnapshot | null {
  if (priceKrw == null) return null;
  const current_value_krw = holding.quantity * priceKrw;
  const pnl_krw = current_value_krw - holding.buy_amount_krw;
  const return_pct = holding.buy_amount_krw > 0 ? (pnl_krw / holding.buy_amount_krw) * 100 : null;
  return {
    ...holding,
    current_price_krw: priceKrw,
    current_value_krw,
    pnl_krw,
    return_pct,
  };
}

export interface PortfolioSummary {
  buy_amount_krw: number;
  current_value_krw: number;
  pnl_krw: number;
  return_pct: number | null;
  snapshots: HoldingSnapshot[];
}

// 전체 보유 + 실시간 티커맵 → 포트폴리오 요약.
export function portfolio(holdings: Holding[], tickers: CryptoTickerMap): PortfolioSummary {
  const snapshots = holdings
    .map((h) => snapshot(h, tickers[h.id]?.price_krw))
    .filter((s): s is HoldingSnapshot => s !== null);

  const totals = snapshots.reduce(
    (acc, s) => {
      acc.buy_amount_krw += s.buy_amount_krw;
      acc.current_value_krw += s.current_value_krw;
      acc.pnl_krw += s.pnl_krw;
      return acc;
    },
    { buy_amount_krw: 0, current_value_krw: 0, pnl_krw: 0 },
  );

  return {
    ...totals,
    return_pct: totals.buy_amount_krw > 0 ? (totals.pnl_krw / totals.buy_amount_krw) * 100 : null,
    snapshots,
  };
}

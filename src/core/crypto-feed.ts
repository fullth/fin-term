// 코인 실시간 피드. 업비트 웹소켓 티커를 store 에 반영하고,
// 보유 수익률이 5% 단위 임계를 넘으면 데스크톱 알림 + 알림 로그를 남긴다.
import { connectLiveTickers } from '../sources/upbit.js';
import { snapshot } from './holdings.js';
import { notify } from './notify.js';
import type { Store } from './store.js';
import type { CryptoTicker } from './types.js';

const ALERT_STEP = 5; // 수익률 알림 임계 간격(%)

// previousPct → currentPct 사이에 걸린 5% 배수 임계들. 상승/하락 양방향.
function crossedSteps(prevPct: number, currPct: number): number[] {
  if (prevPct === currPct) return [];
  const steps: number[] = [];
  if (currPct > prevPct) {
    const start = Math.ceil((prevPct + Number.EPSILON) / ALERT_STEP) * ALERT_STEP;
    for (let s = start; s <= currPct; s += ALERT_STEP) steps.push(s);
  } else {
    const start = Math.floor((prevPct - Number.EPSILON) / ALERT_STEP) * ALERT_STEP;
    for (let s = start; s >= currPct; s -= ALERT_STEP) steps.push(s);
  }
  return steps;
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export class CryptoFeed {
  private prevReturns = new Map<string, number>(); // 코인 id → 직전 수익률
  private conn: { stop: () => void } | null = null;

  constructor(private store: Store) {}

  start() {
    this.store.setFeedStatus('connecting');
    this.conn = connectLiveTickers({
      onStatus: (status) => this.store.setFeedStatus(status),
      onTicker: (ticker) => this.handleTicker(ticker),
    });
  }

  stop() {
    this.conn?.stop();
    this.conn = null;
  }

  private handleTicker(ticker: CryptoTicker) {
    this.store.setCryptoTicker(ticker);
    this.checkReturnAlert(ticker);
  }

  // 보유 수익률 5% 단위 돌파 알림.
  private checkReturnAlert(ticker: CryptoTicker) {
    const holding = this.store.get().holdings.find((h) => h.id === ticker.id);
    if (!holding) return;
    const snap = snapshot(holding, ticker.price_krw);
    if (!snap || snap.return_pct == null) return;

    const prev = this.prevReturns.get(ticker.id);
    this.prevReturns.set(ticker.id, snap.return_pct);
    if (prev == null) return; // 첫 측정은 기준점만 잡고 건너뜀

    for (const step of crossedSteps(prev, snap.return_pct)) {
      const direction = snap.return_pct >= prev ? '상향 돌파' : '하향 이탈';
      this.store.pushAlert(`${ticker.symbol} 수익률 ${fmtPct(step)} ${direction}`);
      notify(
        '코인 수익률 알림',
        `${ticker.symbol} ${fmtPct(step)}`,
        `${direction} · 현재 ${fmtPct(snap.return_pct)}`,
      );
    }
  }
}

// 가격 알림 — localStorage 기반, 만료 없음. 코인/주식 공용.
// 기준가 대비 ±threshold% 도달 시 알림. 알림 후 기준가 리셋(반복 방지). 기준가는 수동 변경 가능.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AlertSettings {
  enabled: boolean;
  threshold: number; // %
}

const DEFAULT: AlertSettings = { enabled: false, threshold: 5 };

function settingsKey(scope: string) {
  return `fin-term:alerts:${scope}`;
}

export function loadAlertSettings(scope: string): AlertSettings {
  try {
    const raw = localStorage.getItem(settingsKey(scope));
    if (!raw) return DEFAULT;
    const s = JSON.parse(raw) as Partial<AlertSettings>;
    return {
      enabled: !!s.enabled,
      threshold: typeof s.threshold === 'number' && s.threshold > 0 ? s.threshold : DEFAULT.threshold,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveAlertSettings(scope: string, s: AlertSettings): void {
  try {
    localStorage.setItem(settingsKey(scope), JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    o.start();
    o.stop(audioCtx.currentTime + 0.36);
  } catch {
    /* 무시 */
  }
}

export function fireAlert(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // requireInteraction: 사용자가 닫기 전까지 유지 (지원 브라우저/OS 한정).
      // OS 알림 표시 시간 자체는 운영체제가 제어하므로 코드로 늘릴 수 있는 건 이 옵션뿐.
      new Notification(title, { body, tag: `fin-term-${title}`, icon: '/favicon.svg', requireInteraction: true });
    } catch {
      /* 무시 */
    }
  }
  beep();
}

// ── 공용 알림 훅 ──────────────────────────────────────────────────────
// scope: 'crypto' | 'stock' (설정 키 분리). label: 알림 문구용 ("코인"/"종목").
export function usePriceAlerts(scope: string) {
  const [settings, setSettings] = useState(() => loadAlertSettings(scope));
  const [bases, setBases] = useState<Record<string, number>>({}); // key → 기준가
  const [toast, setToast] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const basesRef = useRef(bases);
  basesRef.current = bases;

  useEffect(() => saveAlertSettings(scope, settings), [scope, settings]);

  // 가격 1건 갱신 시 호출 — key(심볼/마켓), price, displayName
  const onPrice = useCallback((key: string, price: number, displayName: string) => {
    if (price == null || !Number.isFinite(price)) return;
    const base = basesRef.current[key];
    if (base == null) {
      // 첫 수신 = 기준가 설정 (꺼져 있어도 기준은 잡아둠)
      basesRef.current[key] = price;
      setBases((b) => ({ ...b, [key]: price }));
      return;
    }
    if (!settingsRef.current.enabled) return;
    const pct = ((price - base) / base) * 100;
    if (Math.abs(pct) >= settingsRef.current.threshold) {
      const dir = pct > 0 ? '▲ 상승' : '▼ 하락';
      const msg = `${displayName} ${dir} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% (${price.toLocaleString('ko-KR')})`;
      fireAlert(`${displayName} ${settingsRef.current.threshold}% ${pct > 0 ? '급등' : '급락'}`, msg);
      setToast(msg);
      setTimeout(() => setToast(null), 12000);
      basesRef.current[key] = price; // 기준 리셋
      setBases((b) => ({ ...b, [key]: price }));
    }
  }, []);

  const setBase = useCallback((key: string, price: number) => {
    basesRef.current[key] = price;
    setBases((b) => ({ ...b, [key]: price }));
  }, []);

  const toggle = useCallback(async () => {
    if (!settingsRef.current.enabled) await requestNotifyPermission();
    setSettings((s) => ({ ...s, enabled: !s.enabled }));
  }, []);

  const setThreshold = useCallback((threshold: number) => {
    setSettings((s) => ({ ...s, threshold: Math.max(0.1, threshold) }));
  }, []);

  return { settings, bases, toast, setToast, onPrice, setBase, toggle, setThreshold };
}

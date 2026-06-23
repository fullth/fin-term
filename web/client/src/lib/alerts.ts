// 가격 알림 — localStorage 기반, 만료 없음. 코인/주식 공용.
// 기준가 대비 ±threshold% 도달 시 알림. 알림 후 기준가 리셋(반복 방지). 기준가는 수동 변경 가능.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AlertSettings {
  enabled: boolean;
  threshold: number; // 공통 임계값 %
}

// 종목별 오버라이드 — threshold 가 있으면 공통값 대신 사용. 없으면 공통값.
export interface AlertOverride {
  threshold?: number;
}

// 발생한 알림 1건 — 메모리에만 보관(페이지 닫으면 소멸), localStorage 미저장.
export interface AlertEvent {
  id: number;
  at: number; // epoch ms
  label: string; // 표시명 (종목명/심볼)
  pct: number; // 변동률 %
  price: number;
  up: boolean; // 상승 여부
}

const HISTORY_MAX = 50; // 메모리 상한

const DEFAULT: AlertSettings = { enabled: false, threshold: 5 };

function settingsKey(scope: string) {
  return `fin-term:alerts:${scope}`;
}
function basesKey(scope: string) {
  return `fin-term:alerts:bases:${scope}`;
}
function overridesKey(scope: string) {
  return `fin-term:alerts:overrides:${scope}`;
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

function loadMap<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}
function saveMap(key: string, m: Record<string, unknown>): void {
  try {
    localStorage.setItem(key, JSON.stringify(m));
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
  const [bases, setBases] = useState<Record<string, number>>(() => loadMap<number>(basesKey(scope)));
  const [overrides, setOverrides] = useState<Record<string, AlertOverride>>(() => loadMap<AlertOverride>(overridesKey(scope)));
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<AlertEvent[]>([]); // 알림 이력 — 메모리 한정
  const eventSeq = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const basesRef = useRef(bases);
  basesRef.current = bases;
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  useEffect(() => saveAlertSettings(scope, settings), [scope, settings]);
  useEffect(() => saveMap(basesKey(scope), bases), [scope, bases]);
  useEffect(() => saveMap(overridesKey(scope), overrides), [scope, overrides]);

  // 종목 유효 임계값 — 개별 오버라이드 우선, 없으면 공통값
  const thresholdOf = (key: string) => overridesRef.current[key]?.threshold ?? settingsRef.current.threshold;

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
    const th = thresholdOf(key);
    if (Math.abs(pct) >= th) {
      const dir = pct > 0 ? '▲ 상승' : '▼ 하락';
      const msg = `${displayName} ${dir} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% (${price.toLocaleString('ko-KR')})`;
      fireAlert(`${displayName} ${th}% ${pct > 0 ? '급등' : '급락'}`, msg);
      setToast(msg);
      setTimeout(() => setToast(null), 12000);
      // 이력 누적 (최신순, 상한 유지)
      const ev: AlertEvent = { id: ++eventSeq.current, at: Date.now(), label: displayName, pct, price, up: pct > 0 };
      setHistory((h) => [ev, ...h].slice(0, HISTORY_MAX));
      basesRef.current[key] = price; // 기준 리셋
      setBases((b) => ({ ...b, [key]: price }));
    }
  }, []);

  const setBase = useCallback((key: string, price: number) => {
    basesRef.current[key] = price;
    setBases((b) => ({ ...b, [key]: price }));
  }, []);

  // 종목별 개별 임계값 설정 (null/undefined 면 오버라이드 제거 = 공통값 사용)
  const setOverrideThreshold = useCallback((key: string, threshold: number | null) => {
    setOverrides((o) => {
      const next = { ...o };
      if (threshold == null || !Number.isFinite(threshold) || threshold <= 0) {
        delete next[key];
      } else {
        next[key] = { ...next[key], threshold: Math.max(0.1, threshold) };
      }
      return next;
    });
  }, []);

  // 모달 확인 시 일괄 커밋 — 기준가/개별임계값/공통임계값 한 번에 반영
  const applyBatch = useCallback(
    (patch: {
      threshold?: number;
      bases?: Record<string, number>;
      overrides?: Record<string, AlertOverride>;
    }) => {
      if (patch.threshold != null) setSettings((s) => ({ ...s, threshold: Math.max(0.1, patch.threshold!) }));
      if (patch.bases) {
        basesRef.current = { ...basesRef.current, ...patch.bases };
        setBases((b) => ({ ...b, ...patch.bases }));
      }
      if (patch.overrides) setOverrides(patch.overrides);
    },
    [],
  );

  // 전체 종목 기준가를 현재가로 리셋
  const resetAllToCurrent = useCallback((rows: { key: string; price: number | null }[]) => {
    const next: Record<string, number> = {};
    for (const r of rows) if (r.price != null && Number.isFinite(r.price)) next[r.key] = r.price;
    basesRef.current = { ...basesRef.current, ...next };
    setBases((b) => ({ ...b, ...next }));
  }, []);

  const toggle = useCallback(async () => {
    if (!settingsRef.current.enabled) await requestNotifyPermission();
    setSettings((s) => ({ ...s, enabled: !s.enabled }));
  }, []);

  const setThreshold = useCallback((threshold: number) => {
    setSettings((s) => ({ ...s, threshold: Math.max(0.1, threshold) }));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return {
    settings,
    bases,
    overrides,
    toast,
    setToast,
    history,
    clearHistory,
    onPrice,
    setBase,
    setOverrideThreshold,
    applyBatch,
    resetAllToCurrent,
    toggle,
    setThreshold,
  };
}

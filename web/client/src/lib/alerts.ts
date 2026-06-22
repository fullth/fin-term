// 코인 가격 알림 — localStorage 기반, 만료 없음.
// 세션 시작가(앱 진입 시 첫 가격) 대비 ±threshold% 도달 시 알림. 알림 후 기준가 리셋해 반복 방지.
const KEY = 'fin-term:alerts';

export interface AlertSettings {
  enabled: boolean;
  threshold: number; // % (기본 5)
}

const DEFAULT: AlertSettings = { enabled: false, threshold: 5 };

export function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(KEY);
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

export function saveAlertSettings(s: AlertSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}

// 브라우저 알림 권한 요청 (사용자 제스처에서 호출)
export async function requestNotifyPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

// 알림 발사 — 브라우저 알림(권한 있으면) + 소리. 토스트는 호출부에서 화면에 표시.
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
    /* 오디오 차단 시 무시 */
  }
}

export function fireAlert(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `fin-term-${title}`, icon: '/favicon.svg' });
    } catch {
      /* 무시 */
    }
  }
  beep();
}

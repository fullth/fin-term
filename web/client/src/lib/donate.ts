// 커피 한 잔 후원 위젯 — show-me-the-coffee 로더로 초기화.
// analytics=true 로 두면 GTM dataLayer 로 사용처 이벤트가 실린다(이 앱은 GTM 사용 중).
import { SMTC } from 'show-me-the-coffee';

const KAKAO_PAY_URL =
  import.meta.env.VITE_KAKAO_PAY_URL || 'https://qr.kakaopay.com/Ej84nMWnw';

let booted = false;

// 위젯 위치를 고정. show-me-the-coffee 는 반응형을 지원하지 않고
// --smtc-offset-* 를 host(#smtc-root)에 직접 세팅하므로, 외부 CSS 로는 못 덮는다.
// → 인라인 스타일(최우선순위)로 CSS 변수를 덮어써 위치를 강제한다.
// 데스크톱: 채널톡 버튼(우하단) 왼쪽에 나란히. 모바일: 채널톡 버튼 위로 올려 겹침 방지.
const DESKTOP = { x: 92, y: 24 };
const MOBILE = { x: 16, y: 96 }; // 채널톡 런처(약 54px + 하단 여백) 위로 — 세로로 확실히 띄운다

function currentOffset(): { x: number; y: number } {
  return window.matchMedia('(max-width: 640px)').matches ? MOBILE : DESKTOP;
}

function applyDonatePosition(): void {
  const el = document.getElementById('smtc-root');
  if (!el) return;
  const { x, y } = currentOffset();
  el.style.setProperty('--smtc-offset-x', `${x}px`);
  el.style.setProperty('--smtc-offset-y', `${y}px`);
}

export function bootDonate(): void {
  if (booted) return;
  booted = true;
  const start = currentOffset();
  SMTC('boot', {
    kakaoPayUrl: KAKAO_PAY_URL,
    name: '임태환',
    label: '커피 후원하기',
    title: '개발자에게 커피 한 잔 ☕',
    description: 'fin-term이 도움이 됐다면 커피값으로 응원해주세요!',
    position: 'br',
    offsetX: start.x,
    offsetY: start.y,
    accentColor: '#1A1A1A', // 채널톡 버튼과 동일한 검정
    textColor: '#ffffff',
    siteKey: 'fin-term',
    analytics: true,
  });

  // 위젯 DOM 이 붙은 뒤 위치 적용(부트는 비동기라 약간 지연) + 뷰포트 변화 대응.
  const apply = () => applyDonatePosition();
  setTimeout(apply, 300);
  setTimeout(apply, 1200); // 느린 로드 대비 재시도
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);

  // stealth(엑셀·업무·시작화면)에서 CSS 로 숨겼다가 풀 때, 채널톡이 걸어둔 인라인
  // display:none 이 남아 위젯이 영영 안 보이는 경우가 있어 주기적으로 복구한다.
  setInterval(() => {
    const el = document.getElementById('smtc-root');
    if (!el) return;
    const stealth = document.documentElement.hasAttribute('data-stealth');
    const messengerOpen = document.documentElement.hasAttribute('data-messenger-open');
    if (!stealth && !messengerOpen && el.style.display === 'none') el.style.display = '';
  }, 1500);
}

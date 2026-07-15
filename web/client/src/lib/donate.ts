// 커피 한 잔 후원 위젯 — show-me-the-coffee 로더로 초기화.
// analytics=true 로 두면 GTM dataLayer 로 사용처 이벤트가 실린다(이 앱은 GTM 사용 중).
import { SMTC } from 'show-me-the-coffee';

const KAKAO_PAY_URL =
  import.meta.env.VITE_KAKAO_PAY_URL || 'https://qr.kakaopay.com/Ej84nMWnw';

let booted = false;

// 위젯 위치를 고정. show-me-the-coffee 는 반응형을 지원하지 않고
// --smtc-offset-* 를 host(#smtc-root)에 직접 세팅하므로, 외부 CSS 로는 못 덮는다.
// → 인라인 스타일(최우선순위)로 CSS 변수를 덮어써 위치를 강제한다.
// 데스크톱·모바일 모두 채널톡 버튼(우하단) 왼쪽에 나란히 둔다.
function applyDonatePosition(): void {
  const el = document.getElementById('smtc-root');
  if (!el) return;
  el.style.setProperty('--smtc-offset-x', '90px');
  el.style.setProperty('--smtc-offset-y', '24px');
}

export function bootDonate(): void {
  if (booted) return;
  booted = true;
  SMTC('boot', {
    kakaoPayUrl: KAKAO_PAY_URL,
    name: '임태환',
    label: '커피 후원하기',
    title: '개발자에게 커피 한 잔 ☕',
    description: 'fin-term이 도움이 됐다면 커피값으로 응원해주세요!',
    position: 'br',
    offsetX: 90,
    offsetY: 24,
    accentColor: '#1A1A1A', // 채널톡 버튼과 동일한 검정
    textColor: '#ffffff',
    siteKey: 'fin-term',
    analytics: true,
  });

  // 위젯 DOM 이 붙은 뒤 위치 적용(부트는 비동기라 약간 지연) + 리사이즈 대응.
  const apply = () => applyDonatePosition();
  setTimeout(apply, 300);
  setTimeout(apply, 1200); // 느린 로드 대비 재시도
  window.addEventListener('resize', apply);
}

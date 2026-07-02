// 커피 한 잔 후원 위젯 — show-me-the-coffee 로더로 초기화.
// analytics=true 로 두면 GTM dataLayer 로 사용처 이벤트가 실린다(이 앱은 GTM 사용 중).
import { SMTC } from 'show-me-the-coffee';

const KAKAO_PAY_URL =
  import.meta.env.VITE_KAKAO_PAY_URL || 'https://qr.kakaopay.com/Ej84nMWnw';

let booted = false;

export function bootDonate(): void {
  if (booted) return;
  booted = true;
  SMTC('boot', {
    kakaoPayUrl: KAKAO_PAY_URL,
    name: '임태환',
    label: '커피 한 잔 후원하기',
    title: '개발자에게 커피 한 잔 ☕',
    description: 'fin-term이 도움이 됐다면 커피값으로 응원해주세요!',
    siteKey: 'fin-term',
    analytics: true,
  });
}

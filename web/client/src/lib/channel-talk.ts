// 채널톡 — 웹 SDK 로더로 초기화. 로그인 개념이 없는 앱이라 익명(memberId 없음)으로 boot.
// pluginKey 는 공개 키(프론트 노출 정상). env(VITE_CHANNEL_PLUGIN_KEY) 가 있으면 우선 사용.
import * as ChannelService from '@channel.io/channel-web-sdk-loader';

const PLUGIN_KEY = import.meta.env.VITE_CHANNEL_PLUGIN_KEY || 'e93da8bb-2405-4266-b4b1-30ed8051dc79';

let booted = false;

export function bootChannelTalk(): void {
  if (booted || !PLUGIN_KEY) return;
  booted = true;
  ChannelService.loadScript();
  ChannelService.boot({ pluginKey: PLUGIN_KEY });

  // 메신저가 열리면 커피 후원 버튼을 숨긴다(특히 모바일: 채널톡이 전체화면으로 뜨는데 커피 버튼이 위에 남는 문제).
  // 닫히면 다시 표시. data-messenger-open 속성으로 상태를 남겨, 다른 코드(donate.ts 복구 루프)가
  // "메신저가 닫혔는데도 숨겨진" 상태를 구분할 수 있게 한다.
  const setDonateHidden = (hidden: boolean) => {
    document.documentElement.toggleAttribute('data-messenger-open', hidden);
    const el = document.getElementById('smtc-root');
    if (el) el.style.display = hidden ? 'none' : '';
  };
  ChannelService.onShowMessenger(() => setDonateHidden(true));
  ChannelService.onHideMessenger(() => setDonateHidden(false));

  // 모바일에서 채널톡을 뒤로가기/스와이프로 닫으면 onHideMessenger 가 안 오는 경우가 있어,
  // 페이지가 다시 보이거나 포커스를 얻을 때 한 번 더 복구를 시도한다.
  const recover = () => {
    if (!document.documentElement.hasAttribute('data-messenger-open')) return;
    document.documentElement.removeAttribute('data-messenger-open');
    const el = document.getElementById('smtc-root');
    if (el && !document.documentElement.hasAttribute('data-stealth')) el.style.display = '';
  };
  window.addEventListener('focus', recover);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recover();
  });
}

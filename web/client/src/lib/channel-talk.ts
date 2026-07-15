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
  // 닫히면 다시 표시. smtc-root 는 show-me-the-coffee 위젯 컨테이너.
  const toggleDonate = (hidden: boolean) => {
    const el = document.getElementById('smtc-root');
    if (el) el.style.display = hidden ? 'none' : '';
  };
  ChannelService.onShowMessenger(() => toggleDonate(true));
  ChannelService.onHideMessenger(() => toggleDonate(false));
}

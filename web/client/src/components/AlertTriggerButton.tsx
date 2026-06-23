// 상단바 변동 알림 버튼 — 주식/코인 공용. 외형(아이콘·라벨·켜짐 표시)을 한 곳에서 관리한다.
// 모달 제어 방식이 모드마다 달라(주식=자체 open, 코인=App 제어) 버튼 렌더만 공유한다.
interface Props {
  enabled: boolean;
  onClick: () => void;
}

export function AlertTriggerButton({ enabled, onClick }: Props) {
  return (
    <button
      className={'mode-btn alert-trigger' + (enabled ? ' on' : '')}
      onClick={onClick}
      title="변동 알림 설정"
    >
      🔔 변동 알림{enabled ? ' ●' : ''}
    </button>
  );
}

import { useEffect, useState } from 'react';

// PWA 설치 유도 버튼 — 자동 설치는 브라우저 정책상 불가, 사용자 동작이 필수.
// Android/PC: beforeinstallprompt 를 잡아 클릭 시 OS 설치 팝업. iOS 사파리: 이벤트 없어 수동 안내.
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS 사파리
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // 이미 설치됨: 버튼 숨김
  if (installed) return null;

  // iOS: beforeinstallprompt 미지원 → 안내만
  if (isIOS()) {
    return (
      <div className="alert-btn-wrap" style={{ position: 'relative' }}>
        <button className="mode-btn" title="홈 화면에 추가" onClick={() => setShowIosHint((v) => !v)}>
          📲 앱 설치
        </button>
        {showIosHint && (
          <div className="install-hint">
            사파리 하단 <b>공유</b> 버튼 → <b>홈 화면에 추가</b> 를 누르면 앱처럼 설치됩니다.
          </div>
        )}
      </div>
    );
  }

  // Android/PC: 설치 프롬프트가 준비됐을 때만 노출
  if (!deferred) return null;
  return (
    <button
      className="mode-btn"
      title="앱으로 설치"
      onClick={async () => {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === 'accepted') setInstalled(true);
        setDeferred(null);
      }}
    >
      📲 앱 설치
    </button>
  );
}

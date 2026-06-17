// 터미널 SGR 마우스 트래킹. ink 는 마우스를 지원하지 않으므로 직접 활성화하고 stdin 을 파싱한다.
// 좌클릭 릴리스 이벤트만 좌표(행/열, 1-based)로 콜백한다.
import { useEffect } from 'react';
import { useStdin, useStdout } from 'ink';

// 1000: 클릭 트래킹, 1006: SGR 확장 좌표(넓은 화면/큰 좌표 대응)
const ENABLE = '\x1b[?1000h\x1b[?1006h';
// 해제 시 blessed 가 켰을 수 있는 1002(드래그)·1003(모션)·1015 까지 모두 끈다.
// 안 그러면 마우스 이동 SGR 이 입력 스트림에 텍스트로 새어 화면을 오염시킨다.
const DISABLE = '\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?1015l';

// SGR: ESC [ < b ; col ; row (M=press, m=release)
const SGR_RE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

export interface MouseClick {
  col: number; // 1-based
  row: number; // 1-based
}

export interface WheelEvent {
  dir: 1 | -1; // 1=아래, -1=위
  col: number;
  row: number;
}

export function useMouse(onClick: (e: MouseClick) => void, onWheel?: (e: WheelEvent) => void): void {
  const { stdin, setRawMode, isRawModeSupported } = useStdin();
  const { stdout } = useStdout();

  useEffect(() => {
    if (!isRawModeSupported || !stdin || !stdout) return;
    setRawMode(true);
    stdout.write(ENABLE);

    const onData = (data: Buffer | string) => {
      const s = typeof data === 'string' ? data : data.toString('utf8');
      SGR_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SGR_RE.exec(s)) !== null) {
        const button = Number(m[1]);
        const col = Number(m[2]);
        const row = Number(m[3]);
        const release = m[4] === 'm';
        // 휠: button 64=위, 65=아래. press(M) 만 오고 release 없음.
        if (button === 64 || button === 65) {
          if (m[4] === 'M') onWheel?.({ dir: button === 65 ? 1 : -1, col, row });
          continue;
        }
        // button 0 = 좌클릭. release(m) 시점에만 발화해 더블 트리거 방지.
        if (button === 0 && release) onClick({ col, row });
      }
    };

    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
      stdout.write(DISABLE);
    };
  }, [stdin, stdout, isRawModeSupported, setRawMode, onClick, onWheel]);
}

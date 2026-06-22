import { useState } from 'react';
import type { AlertSettings } from '../lib/alerts';
import { AlertPanel } from './AlertPanel';

interface Row { key: string; label: string; price: number | null; }
interface Props {
  settings: AlertSettings;
  bases: Record<string, number>;
  rows: Row[];
  fmt: (n: number | null) => string;
  onToggle: () => void;
  onThreshold: (n: number) => void;
  onSetBase: (key: string, price: number) => void;
}

// 상단바용 - 알림 버튼 + 클릭 시 AlertPanel 팝오버 (테마/AI키 칩 옆)
export function AlertButton(props: Props) {
  const [open, setOpen] = useState(false);
  const on = props.settings.enabled;
  return (
    <div className="alert-btn-wrap" style={{ position: 'relative' }}>
      <button className={'mode-btn' + (on ? ' active' : '')} onClick={() => setOpen((o) => !o)} title="가격 알림 설정">
        {on ? '알림 ●' : '알림'}
      </button>
      {open && (
        <div className="alert-pop">
          <AlertPanel {...props} />
        </div>
      )}
    </div>
  );
}

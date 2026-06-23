import { useState } from 'react';
import type { AlertSettings, AlertOverride } from '../lib/alerts';
import { AlertSettingsModal } from './AlertSettingsModal';

interface Row { key: string; label: string; price: number | null; }
interface Props {
  settings: AlertSettings;
  bases: Record<string, number>;
  overrides: Record<string, AlertOverride>;
  rows: Row[];
  fmt: (n: number | null) => string;
  onToggle: () => void;
  onApply: (patch: { threshold?: number; bases?: Record<string, number>; overrides?: Record<string, AlertOverride> }) => void;
}

// 상단바용 - 알림 버튼 + 클릭 시 설정 모달 (테마/AI키 칩 옆)
export function AlertButton({ settings, bases, overrides, rows, fmt, onToggle, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const on = settings.enabled;
  return (
    <div className="alert-btn-wrap" style={{ position: 'relative' }}>
      <button className={'mode-btn' + (on ? ' active' : '')} onClick={() => setOpen(true)} title="가격 알림 설정">
        {on ? '알림 ●' : '알림'}
      </button>
      {open && (
        <AlertSettingsModal
          settings={settings}
          bases={bases}
          overrides={overrides}
          rows={rows}
          fmt={fmt}
          onClose={() => setOpen(false)}
          onToggle={onToggle}
          onApply={onApply}
        />
      )}
    </div>
  );
}

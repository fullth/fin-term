import { useState } from 'react';
import { loadAiKey, saveAiKey, clearAiKey, daysLeft, maskKey, fmtDate, isExpired } from '../lib/ai-key';

interface Props {
  onChange: () => void; // 키 변경 시 부모에게 알림 (AI 기능 활성 갱신)
}

// 상단바 AI 키 상태 칩 + 입력 팝오버. 키는 브라우저 localStorage 에만 보관.
export function AiKeyManager({ onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [stored, setStored] = useState(loadAiKey());

  const expired = isExpired(stored);
  const active = stored && !expired;

  const save = () => {
    if (!input.trim()) return;
    const s = saveAiKey(input.trim());
    setStored(s);
    setInput('');
    setOpen(false);
    onChange();
  };
  const remove = () => {
    clearAiKey();
    setStored(null);
    setOpen(false);
    onChange();
  };

  const label = active ? `ai-key ✓` : expired ? `ai-key !` : `ai-key`;
  const cls = active ? 'aikey-ok' : 'aikey-need';

  return (
    <div className="aikey" style={{ position: 'relative' }}>
      <button className={`mode-btn ${cls}`} onClick={() => setOpen((o) => !o)} title="AI 기능용 Anthropic 키 관리">
        {label}
      </button>
      {open && (
        <div className="aikey-pop">
          <div className="aikey-title">AI 기능 키 (Anthropic)</div>
          <div className="dim" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>
            시장 브리핑·용어 풀이에 사용됩니다. 키는 이 브라우저에만 저장되고 요청 시에만 전송됩니다.
            <br />
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style={{ color: 'var(--cyan)' }}>
              console.anthropic.com
            </a>{' '}
            에서 발급 (sk-ant-…)
          </div>
          {stored && (
            <div className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
              현재 키: <b style={{ color: 'var(--txt)' }}>{maskKey(stored.key)}</b>
              <br />
              {expired ? (
                <span className="down">만료됨 ({fmtDate(stored.expiresAt)}) — 재입력 필요</span>
              ) : (
                <span>
                  만료 예정: {fmtDate(stored.expiresAt)} (<span className="up">{daysLeft(stored)}일 남음</span>)
                </span>
              )}
            </div>
          )}
          <input
            type="password"
            className="aikey-input"
            value={input}
            placeholder="sk-ant-..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="mode-btn aikey-ok" onClick={save} style={{ flex: 1 }}>
              저장 (30일 보관)
            </button>
            {stored && (
              <button className="mode-btn" onClick={remove}>
                삭제
              </button>
            )}
            <button className="mode-btn" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

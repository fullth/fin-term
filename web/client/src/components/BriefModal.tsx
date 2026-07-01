import { useEffect, useState } from 'react';
import type { BriefEntry } from '../lib/storage';

// AI 시장 브리핑 모달 — 탭으로 지난 브리핑들(생성 시각별) 조회 + 본문 표시 + 새 브리핑 생성.
// 히스토리는 App 이 소유(리포트 생성용으로 누적). 여기서는 표시·선택만 담당한다.

interface Props {
  history: BriefEntry[]; // 최신순
  current: string | null; // 최근 생성/복원된 본문 (히스토리 없을 때 fallback)
  loading: boolean;
  err: string | null;
  usable: boolean; // 서버 AI 키 보유 여부
  onGenerate: () => void;
  onClose: () => void;
}

function fmtAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function BriefModal({ history, current, loading, err, usable, onGenerate, onClose }: Props) {
  const [sel, setSel] = useState(0); // 선택된 탭 인덱스 (0 = 최신)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 새 브리핑이 생성되면 최신 탭으로
  useEffect(() => {
    setSel(0);
  }, [history.length]);

  // 표시 본문 — 히스토리 있으면 선택 탭, 없으면 current fallback
  const body = history.length ? history[Math.min(sel, history.length - 1)]?.text : current;

  return (
    <div className="brief-overlay" onClick={onClose}>
      <div className="brief-modal" onClick={(e) => e.stopPropagation()}>
        <div className="brief-head">
          <span className="brief-title">AI 시장 브리핑</span>
          <button className="brief-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 탭 — 생성 시각별 */}
        {history.length > 0 && (
          <div className="brief-tabs">
            {history.map((h, i) => (
              <button key={h.at} className={`brief-tab${sel === i ? ' on' : ''}`} onClick={() => setSel(i)}>
                {i === 0 ? '최신' : fmtAt(h.at)}
              </button>
            ))}
          </div>
        )}

        <div className="brief-body">
          {loading ? (
            <div className="dim">생성 중…</div>
          ) : body ? (
            <div className="brief-text">{body}</div>
          ) : err ? (
            <div className="brief-err">✗ {err}</div>
          ) : (
            <div className="dim">
              {usable ? '아직 생성된 브리핑이 없습니다. 아래 버튼으로 생성하세요.' : '서버에 AI 키가 없어 브리핑을 생성할 수 없습니다.'}
            </div>
          )}
        </div>

        <div className="brief-foot">
          {history.length > 0 && sel < history.length && (
            <span className="brief-at">{fmtAt(history[Math.min(sel, history.length - 1)].at)} 생성</span>
          )}
          <button className="brief-gen" onClick={onGenerate} disabled={loading || !usable} title={usable ? '' : '서버 AI 키 없음'}>
            {loading ? '생성 중…' : '＋ 새 브리핑 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

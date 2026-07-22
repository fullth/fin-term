// 사용 안내(매뉴얼) 모달 — 상단바 "?" 버튼으로 연다. 단축키·모드·데이터 출처 안내.
import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: '/', desc: '종목 검색창 포커스' },
  { key: 'j / k', desc: '관심종목 아래 / 위 이동' },
  { key: 'm', desc: '주식 ↔ 코인 모드 전환' },
  { key: '`', desc: '엑셀 모드 켜기 / 끄기' },
  { key: 'Esc', desc: '뉴스 필터 해제' },
];

export function ManualModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="manual-overlay" onClick={onClose}>
      <div className="manual-box" onClick={(e) => e.stopPropagation()}>
        <div className="manual-head">
          <span className="manual-title">fin-term 사용 안내</span>
          <button className="manual-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="manual-section">
          <h4>모드</h4>
          <ul>
            <li><b>주식 / 코인</b> — 상단 버튼 또는 <code>m</code> 키로 전환</li>
            <li><b>Diary</b> — 생성한 브리핑을 다시 읽고 내 판단·실행 계획을 함께 기록</li>
            <li><b>단색</b> — 현재 화면 전체를 흑백으로 바꾸고 등락 색도 숨김</li>
            <li><b>엑셀</b> — 화면을 스프레드시트로 위장. <code>`</code> 키 또는 버튼, 엑셀 화면의 <b>닫기</b>로 복귀</li>
          </ul>
        </div>

        <div className="manual-section">
          <h4>키보드 단축키</h4>
          <table className="manual-keys">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.key}>
                  <td><kbd>{s.key}</kbd></td>
                  <td>{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="manual-section">
          <h4>기능</h4>
          <ul>
            <li>관심종목 시세는 실시간(SSE)으로 갱신됩니다</li>
            <li>종목 검색 후 Enter/클릭으로 관심목록에 추가 (한글·영문 모두 지원)</li>
            <li>관심종목의 <b>뉴스</b> 태그로 해당 종목 뉴스만 필터링</li>
            <li>변동 알림은 상단 <b>변동 알림</b>에서 종목별 기준가 설정</li>
            <li>AI 브리핑·용어 풀이는 상단 <b>AI 키</b> 입력 시 활성화</li>
            <li>터미널의 <code>brief</code> 결과는 Diary에 누적되며, 투자 일지는 현재 브라우저에 자동 저장</li>
          </ul>
        </div>

        <div className="manual-foot">데이터: Naver · Upbit · RSS · Yahoo(폴백) · 키 없이 동작</div>
      </div>
    </div>
  );
}

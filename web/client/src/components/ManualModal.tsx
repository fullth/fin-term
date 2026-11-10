// 사용 안내(매뉴얼) 모달 — 상단바 "?" 버튼으로 연다. 단축키·모드·데이터 출처 안내.
import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: '/', desc: '종목 검색창 포커스' },
  { key: 'j / k', desc: '관심종목 아래 / 위 이동' },
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
            <li><b>주식+코인</b> — 두 시장을 한 화면에서 확인</li>
            <li><b>Terminal / Excel / 업무</b> — 같은 화면 박스의 보기 도구 버튼으로 바로 선택</li>
            <li><b>alert</b> — 주식과 코인 변동 알림을 하나의 메뉴에서 설정</li>
            <li><b>투자일지</b> — 매일 오전 7시 공개되는 브리핑과 내 판단, 실행 계획을 함께 기록</li>
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
            <li>주식+코인 화면에서 교차시장 신호와 두 시장을 나란히 확인</li>
            <li><b>업무 화면</b> — 등락 색상을 회색 계열로 낮추고 채팅과 후원 위젯을 숨김</li>
            <li><b>Excel 위장 검색</b> — 리본에서 주식과 코인을 함께 검색하고 관심목록에 바로 추가</li>
            <li><b>시작 화면</b> — 서비스 소개를 확인하고, 이후에는 상단 로고로 다시 열기</li>
            <li>뉴스는 중복을 줄이고 핵심, 속보, 전체 보기로 구분</li>
            <li>모바일에서는 각 관심종목의 삭제 버튼으로 목록을 바로 정리</li>
            <li>Terminal에서 코인 시세, 검색, 뉴스 명령을 바로 사용</li>
            <li>관심종목의 <b>뉴스</b> 태그로 해당 종목 뉴스만 필터링</li>
            <li>변동 알림은 상단 <b>alert</b> 메뉴에서 종목별 기준가 설정</li>
            <li>AI 브리핑은 서버에서 매일 오전 7시 생성해 공유</li>
            <li>터미널의 <code>brief</code>로 공유 브리핑을 조회하며, 투자 일지는 현재 브라우저에 자동 저장</li>
          </ul>
        </div>

        <div className="manual-foot">데이터: Naver · Upbit · RSS · Yahoo(폴백) · 키 없이 동작</div>
      </div>
    </div>
  );
}

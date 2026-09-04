// 사용 안내(매뉴얼) 모달 — 상단바 "?" 버튼으로 연다. 단축키·모드·데이터 출처 안내.
import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: '/', desc: '종목 검색창 포커스' },
  { key: 'j / k', desc: '관심종목 아래 / 위 이동' },
  { key: 'm', desc: '주식+코인 → 주식 → 코인 시장 모드 순환' },
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
            <li><b>주식+코인 / 주식 / 코인</b> — 상단 <b>화면</b> 박스에서 선택. 주식+코인은 두 시장을 함께 표시, <code>m</code> 키로도 전환</li>
            <li><b>Terminal / Excel / 업무</b> — 같은 화면 박스의 보기 도구 버튼으로 바로 선택</li>
            <li><b>알림</b> — 알림 센터에서 주식·코인 가격 알림을 켜고 최근 알림 이력을 확인</li>
            <li><b>투자일지</b> — 오늘의 브리핑을 직접 생성하고 내 판단·실행 계획을 함께 기록</li>
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
            <li>주식+코인 화면에서 교차시장 신호를 확인하고 주식/코인 화면 비율을 조절</li>
            <li><b>업무 화면</b> — 등락 색상을 회색 계열로 낮추고 채팅과 후원 위젯을 숨김</li>
            <li><b>Excel 위장 검색</b> — 리본에서 주식과 코인을 함께 검색하고 관심목록에 바로 추가</li>
            <li><b>시작 화면</b> — 첫 방문에 주요 보기 방식을 선택하고, 이후에는 상단 로고로 다시 열기</li>
            <li>뉴스는 중복을 줄이고 핵심, 속보, 전체 보기로 구분</li>
            <li>모바일에서는 각 관심종목의 삭제 버튼으로 목록을 바로 정리</li>
            <li>코인 모드에서 Terminal을 열면 코인 시세, 검색, 뉴스 명령을 바로 사용</li>
            <li>관심종목의 <b>뉴스</b> 태그로 해당 종목 뉴스만 필터링</li>
            <li>가격 알림은 상단 <b>알림</b> 버튼의 알림 센터에서 켜고, 종목별 기준가는 <b>종목별 설정</b>에서 조정</li>
            <li>AI 브리핑·용어 풀이는 상단 <b>AI 키</b> 입력 시 활성화</li>
            <li>투자일지 생성 버튼과 터미널의 <code>brief</code> 결과는 같은 이력에 누적되며, 투자 일지는 현재 브라우저에 자동 저장</li>
          </ul>
        </div>

        <div className="manual-foot">데이터: Naver · Upbit · RSS · Yahoo(폴백) · 키 없이 동작</div>
      </div>
    </div>
  );
}

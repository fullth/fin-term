// 사용 안내(매뉴얼) 모달 — 상단바 "?" 버튼으로 연다. 단축키·모드·데이터 출처 안내.
import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: '/', desc: '종목 검색창 열기' },
  { key: 'j / k', desc: '관심종목 아래 / 위 이동' },
  { key: '`', desc: 'Excel 위장 화면 켜기 / 끄기' },
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
          <h4>화면</h4>
          <ul>
            <li><b>대시보드</b> — 주식과 코인을 한 화면에서 확인. 왼쪽이 주식, 오른쪽이 코인</li>
            <li><b>투자일지</b> — 매일 오전 7시 공개되는 AI 브리핑에 내 판단과 실행 계획을 함께 기록</li>
            <li><b>도구 / 설정</b> — Terminal, Excel, 업무 화면과 알림, 앱 설치를 여기서 선택</li>
            <li><b>Excel</b> — 화면을 스프레드시트로 위장. <code>`</code> 키로 켜고 끄며, Excel 화면의 <b>화면 복귀</b>로도 돌아옴</li>
            <li><b>업무</b> — 등락 색상을 회색 계열로 낮추고 문의·후원 버튼을 숨김</li>
            <li><b>Terminal</b> — 명령어로 시세, 검색, 뉴스, 브리핑을 조회</li>
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
            <li>주식 시세는 약 1분 간격, 코인 시세는 업비트 실시간으로 갱신</li>
            <li><b>+ 종목 추가</b>, <b>+ 코인 추가</b>에서 검색 후 Enter 또는 클릭으로 관심목록에 추가 (한글·영문 모두 지원)</li>
            <li>관심목록은 × 버튼 또는 우클릭으로 삭제</li>
            <li>관심종목의 <b>뉴스</b> 버튼으로 해당 종목 뉴스만 보기</li>
            <li>뉴스는 중복을 줄이고 핵심, 속보, 최신으로 구분</li>
            <li>가격 알림은 <b>도구 / 설정</b>의 <b>알림</b>에서 종목별 기준가와 변동 폭을 설정</li>
            <li>속보는 소리 없이 화면 알림으로만 표시</li>
            <li>AI 브리핑은 서버에서 매일 오전 7시에 한 번 생성해 모두에게 공개</li>
            <li>투자일지는 이 브라우저에만 저장되며 <b>기록 내보내기</b>로 파일 보관 가능</li>
            <li>상단 로고를 누르면 대시보드로 이동</li>
          </ul>
        </div>

        <div className="manual-foot">데이터: Naver · Upbit · RSS · Yahoo(폴백) · 모든 정보는 투자 참고용이며 투자 권유가 아닙니다</div>
      </div>
    </div>
  );
}

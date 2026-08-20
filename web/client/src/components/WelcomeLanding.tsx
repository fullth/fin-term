interface Props {
  onStart: () => void;
  onOffice: () => void;
  onExcel: () => void;
}

export function WelcomeLanding({ onStart, onOffice, onExcel }: Props) {
  return (
    <div className="welcome-landing" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <div className="welcome-brand">
          <img src="/favicon.svg" alt="" />
          <div>
            <span>STOCK + CRYPTO WORKSPACE</span>
            <h1 id="welcome-title">fin-term</h1>
          </div>
        </div>
        <p className="welcome-copy">
          주식과 코인을 한 화면에서 비교하고, 필요한 방식으로 조용하게 확인하세요.
        </p>
        <div className="welcome-features" aria-label="주요 기능">
          <span><b>01</b> 종합 시장 모니터</span>
          <span><b>02</b> 업무용 저채도 화면</span>
          <span><b>03</b> 검색 가능한 Excel 화면</span>
        </div>
        <div className="welcome-actions">
          <button className="welcome-primary" onClick={onStart}>
            종합 화면 시작 <span>→</span>
          </button>
          <button onClick={onOffice}>업무 화면으로 시작</button>
          <button onClick={onExcel}>Excel로 시작</button>
        </div>
        <small>선택한 시장과 업무 화면 설정은 다음 방문에도 유지됩니다.</small>
      </div>
    </div>
  );
}

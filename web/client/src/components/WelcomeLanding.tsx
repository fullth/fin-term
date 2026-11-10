interface Props {
  onStart: () => void;
}

export function WelcomeLanding({ onStart }: Props) {
  return (
    <div className="welcome-landing" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <div className="welcome-brand">
          <img src="/favicon.svg" alt="" />
          <div>
            <span>STOCK + CRYPTO</span>
            <h1 id="welcome-title">fin-term</h1>
          </div>
        </div>
        <div className="welcome-actions">
          <button className="welcome-primary" onClick={onStart}>시작하기 <span>→</span></button>
        </div>
      </div>
    </div>
  );
}

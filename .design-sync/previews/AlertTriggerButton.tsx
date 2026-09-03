import { AlertTriggerButton } from 'fin-term-client';

// AlertTriggerButton is the top-bar 변동 알림 toggle button. Red outline;
// when enabled it gains a filled ring and a ● after the label.

export const Off = () => (
  <div className="topbar" style={{ display: 'inline-flex' }}>
    <AlertTriggerButton enabled={false} onClick={() => {}} />
  </div>
);

export const On = () => (
  <div className="topbar" style={{ display: 'inline-flex' }}>
    <AlertTriggerButton enabled onClick={() => {}} />
  </div>
);

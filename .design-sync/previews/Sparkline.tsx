import type { ReactNode } from 'react';
import { Sparkline } from 'fin-term-client';

// A rising intraday series and a falling one — the two states the component
// has. Shown on the app's dark panel so the var(--up) / var(--down) strokes
// read the way they do in product.

const RISING = [
  128.4, 128.1, 128.9, 129.3, 129.0, 130.2, 131.1, 130.8, 131.9, 132.4,
  132.0, 133.1, 134.0, 133.6, 134.8, 135.5, 135.1, 136.2, 137.0, 138.3,
];
const DECLINING = [
  512.0, 511.2, 511.8, 510.1, 509.4, 509.9, 508.2, 507.0, 507.6, 505.9,
  504.1, 504.7, 503.0, 502.3, 502.8, 500.4, 499.1, 499.7, 497.2, 495.6,
];

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="panel" style={{ maxWidth: 460 }}>
      <div className="ptitle t-yellow">SPARK</div>
      {children}
    </div>
  );
}

export const Rising = () => (
  <Panel>
    <Sparkline values={RISING} positive />
  </Panel>
);

export const Declining = () => (
  <Panel>
    <Sparkline values={DECLINING} positive={false} />
  </Panel>
);

export const Compact = () => (
  <Panel>
    <Sparkline values={RISING} positive height={24} />
  </Panel>
);

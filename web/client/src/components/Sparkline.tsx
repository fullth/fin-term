// 인트라데이 스파크라인. TUI 의 유니코드 스파크라인을 SVG polyline 으로 대체.
interface Props {
  values: number[];
  positive: boolean; // 색상 (상승=green / 하락=red)
  width?: number;
  height?: number;
}

export function Sparkline({ values, positive, width = 400, height = 48 }: Props) {
  if (values.length < 2) return <svg className="spark" width="100%" height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="spark" width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={positive ? 'var(--up)' : 'var(--down)'} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

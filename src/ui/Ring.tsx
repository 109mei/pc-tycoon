/** 進み具合・残り時間の輪（SVG）。value は 0〜1 */
export function Ring({
  value,
  size,
  width,
  color,
  track,
  className,
  smooth = true,
}: {
  value: number;
  size: number;
  width: number;
  color: string;
  track: string;
  className?: string;
  smooth?: boolean;
}) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg className={`ring-svg${className ? ` ${className}` : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={width} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={smooth ? { transition: 'stroke-dashoffset 0.1s linear' } : undefined}
        opacity={v <= 0.001 ? 0 : 1}
      />
    </svg>
  );
}

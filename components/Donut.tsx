// Dependency-free SVG donut chart. Segments render as stroked arcs; the ring is rotated -90°
// so the first segment starts at 12 o'clock.
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  size = 132,
  thickness = 14,
  centerTop,
  centerBottom,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerTop?: React.ReactNode;
  centerBottom?: React.ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-edge)" strokeWidth={thickness} opacity={0.4} />
        {segments.map((s, i) => {
          const len = (s.value / total) * C;
          const node = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(len - 1.5, 0)} ${C - Math.max(len - 1.5, 0)}`}
              strokeDashoffset={-acc}
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
          );
          acc += len;
          return node;
        })}
      </svg>
      {(centerTop || centerBottom) && (
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-2xl font-bold leading-none text-ink">{centerTop}</div>
            {centerBottom && <div className="mono mt-1 text-[10px] uppercase tracking-wider text-faint">{centerBottom}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

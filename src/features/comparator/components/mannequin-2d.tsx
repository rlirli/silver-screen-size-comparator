interface Mannequin2DProps {
  pxPerMeter: number;
}

export function Mannequin2D({ pxPerMeter }: Mannequin2DProps) {
  const heightMeters = 1.75;
  const heightPx = heightMeters * pxPerMeter;
  const widthPx = 0.5 * pxPerMeter; // Shoulder width approx 0.5m

  // SVG representation of a mannequin silhouette centered at (0, 0) bottom center
  // Draw upwards from bottom (y = 0)
  return (
    <g className="text-brand fill-current opacity-85 select-none">
      {/* Head */}
      <circle cx={0} cy={-heightPx + 0.22 * pxPerMeter} r={0.11 * pxPerMeter} />

      {/* Neck */}
      <rect
        x={-0.03 * pxPerMeter}
        y={-heightPx + 0.33 * pxPerMeter}
        width={0.06 * pxPerMeter}
        height={0.05 * pxPerMeter}
        rx={0.01 * pxPerMeter}
      />

      {/* Torso & Arms */}
      <path
        d={`
          M ${-widthPx / 2} ${-heightPx + 0.38 * pxPerMeter}
          C ${-widthPx / 2} ${-heightPx + 0.38 * pxPerMeter}, ${-widthPx / 2 - 0.02 * pxPerMeter} ${-heightPx + 0.45 * pxPerMeter}, ${-widthPx / 2} ${-heightPx + 0.75 * pxPerMeter}
          C ${-widthPx / 2 + 0.02 * pxPerMeter} ${-heightPx + 0.9 * pxPerMeter}, ${-widthPx / 2 + 0.06 * pxPerMeter} ${-heightPx + 0.9 * pxPerMeter}, ${-widthPx / 2 + 0.08 * pxPerMeter} ${-heightPx + 0.75 * pxPerMeter}
          V ${-heightPx + 0.95 * pxPerMeter}
          H ${-0.08 * pxPerMeter}
          V ${-heightPx + 1.05 * pxPerMeter}
          V 0
          H ${-0.01 * pxPerMeter}
          V ${-heightPx + 1.05 * pxPerMeter}
          H ${0.01 * pxPerMeter}
          V 0
          H ${0.08 * pxPerMeter}
          V ${-heightPx + 0.95 * pxPerMeter}
          H ${widthPx / 2 - 0.08 * pxPerMeter}
          C ${widthPx / 2 - 0.06 * pxPerMeter} ${-heightPx + 0.9 * pxPerMeter}, ${widthPx / 2 - 0.02 * pxPerMeter} ${-heightPx + 0.9 * pxPerMeter}, ${widthPx / 2} ${-heightPx + 0.75 * pxPerMeter}
          C ${widthPx / 2 + 0.02 * pxPerMeter} ${-heightPx + 0.45 * pxPerMeter}, ${widthPx / 2} ${-heightPx + 0.38 * pxPerMeter}, ${widthPx / 2} ${-heightPx + 0.38 * pxPerMeter}
          Z
        `}
      />

      {/* Ground indicator line */}
      <line
        x1={-0.6 * pxPerMeter}
        y1={0}
        x2={0.6 * pxPerMeter}
        y2={0}
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
      />

      {/* Label */}
      <text
        x={0}
        y={15}
        textAnchor="middle"
        className="text-[9px] font-mono fill-text-secondary font-semibold"
      >
        Person (1.75m)
      </text>
    </g>
  );
}

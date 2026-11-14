/**
 * Connection Line Preview
 * Visual preview component showing connection line with current style settings
 */

interface ConnectionLinePreviewProps {
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  strokeWidth: number;
  strokeDasharray?: string;
  width?: number;
  height?: number;
}

const ConnectionLinePreview = ({
  color,
  lineStyle,
  strokeWidth,
  strokeDasharray,
  width = 120,
  height = 40,
}: ConnectionLinePreviewProps) => {
  // Calculate stroke dash array based on line style if not explicitly provided
  const getStrokeDasharray = () => {
    if (strokeDasharray) return strokeDasharray;

    switch (lineStyle) {
      case 'dashed':
        return '8 4';
      case 'dotted':
        return '1 5';
      case 'solid':
      default:
        return 'none';
    }
  };

  const dashArray = getStrokeDasharray();

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="border border-[var(--border-color)] rounded"
    >
      {/* Background */}
      <rect width={width} height={height} fill="var(--bg-canvas)" />

      {/* Connection Line */}
      <line
        x1={10}
        y1={height / 2}
        x2={width - 10}
        y2={height / 2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeLinecap="round"
      />

      {/* Start dot */}
      <circle
        cx={10}
        cy={height / 2}
        r={3}
        fill={color}
      />

      {/* End dot */}
      <circle
        cx={width - 10}
        cy={height / 2}
        r={3}
        fill={color}
      />
    </svg>
  );
};

export default ConnectionLinePreview;

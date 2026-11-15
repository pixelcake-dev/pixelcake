/**
 * Particle Edge Component
 * Wrapper around CustomEdge that adds continuous particle flow animation
 * Uses CSS offset-path for GPU-accelerated particle movement
 * Zero impact on PacketAnimation (CustomEdge remains unchanged)
 */

import { type EdgeProps, getSmoothStepPath } from 'reactflow';
import CustomEdge from './CustomEdge';
import { useCableRun } from './useCableRun';
import type { NetworkConnection } from '@/types/network';

interface ParticleEdgeProps extends EdgeProps<NetworkConnection> {
  data?: NetworkConnection & {
    particleCount?: number;
    particleSpeed?: number; // Duration in seconds
    particleSize?: number;
    particleOpacity?: number;
  };
}

const ParticleEdge = (props: ParticleEdgeProps) => {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  } = props;

  // Calculate smooth step path (same logic as CustomEdge, the same middle run)
  const run = useCableRun(source, target, sourcePosition, targetPosition);
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    ...run,
  });

  // Particle settings (from connection data or defaults)
  const particleCount = data?.particleCount ?? 10;
  const animationDuration = data?.particleSpeed ?? 3; // 3 seconds default
  const particleColor = data?.color || 'rgba(100, 200, 255, 0.9)'; // Brighter blue with higher opacity
  const particleSize = data?.particleSize ?? 3.5; // Increased size for better visibility

  // Create particles with staggered animation delays for uniform distribution
  const particles = Array.from({ length: particleCount }).map((_, index) => {
    // Negative delay makes animation start already in progress
    const delay = (index / particleCount) * animationDuration;

    const style: React.CSSProperties = {
      // CSS offset-path: particle follows SVG path
      offsetPath: `path('${edgePath}')`,
      // Animation duration (CSS variable)
      ['--animation-duration' as string]: `${animationDuration}s`,
      // Staggered start for uniform distribution
      animationDelay: `-${delay}s`,
    };

    return (
      <circle
        key={`${id}-particle-${index}`}
        r={particleSize}
        fill={particleColor}
        className="animated-particle"
        style={style}
      />
    );
  });

  return (
    <>
      {/* Render normal CustomEdge (unchanged - PacketAnimation compatibility) */}
      <CustomEdge {...props} />

      {/* Add particle layer on top (pointer-events: none for transparency) */}
      <g style={{ pointerEvents: 'none' }}>
        {particles}
      </g>
    </>
  );
};

export default ParticleEdge;

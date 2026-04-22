import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import type { TimelineClip } from '../../lib/types';

export const KenBurnsStill: React.FC<{ clip: TimelineClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const total = Math.max(1, durationInFrames);

  const kb = clip.kenBurns ?? {
    from: { scale: 1.0, x: 0, y: 0 },
    to: { scale: 1.1, x: 0, y: 0 },
  };

  const scale = interpolate(frame, [0, total], [kb.from.scale, kb.to.scale]);
  const x = interpolate(frame, [0, total], [kb.from.x, kb.to.x]);
  const y = interpolate(frame, [0, total], [kb.from.y, kb.to.y]);

  const fadeFrames = 8;
  const opacity = interpolate(
    frame,
    [0, fadeFrames, total - fadeFrames, total],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill
        style={{
          transform: `translate(${x}%, ${y}%) scale(${scale})`,
          transformOrigin: 'center center',
          opacity,
        }}
      >
        <Img
          src={clip.asset.url}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.6) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

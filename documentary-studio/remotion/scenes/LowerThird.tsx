import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion';

export const LowerThird: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slide = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 120, mass: 0.6 },
  });
  const translateX = (1 - slide) * -600;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 80,
          bottom: 120,
          transform: `translateX(${translateX}px)`,
          backgroundColor: 'rgba(0,0,0,0.72)',
          borderLeft: '6px solid #d4a84b',
          padding: '18px 28px',
          color: 'white',
          fontFamily: 'Georgia, serif',
          maxWidth: 900,
        }}
      >
        <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: 0.5 }}>
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: 24,
              fontStyle: 'italic',
              color: '#cbd1d8',
              marginTop: 6,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

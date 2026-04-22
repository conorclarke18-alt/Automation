import { AbsoluteFill, OffthreadVideo, useCurrentFrame, interpolate } from 'remotion';
import type { TimelineClip } from '../../lib/types';

export const BRollClip: React.FC<{ clip: TimelineClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  // Gentle fade-in/out across the clip for documentary feel.
  const fadeFrames = 6;
  const opacity = interpolate(
    frame,
    [0, fadeFrames, Math.max(fadeFrames + 1, 60), 60 + fadeFrames],
    [0, 1, 1, 1],
    { extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <OffthreadVideo
        src={clip.asset.url}
        // Start at source offset so we can use middle segments of clips.
        startFrom={Math.max(0, Math.round(clip.sourceOffsetSec * 30))}
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity,
        }}
      />
      {/* Subtle vignette for documentary mood */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

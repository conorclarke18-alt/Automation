import { Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import type { MusicBed as MusicBedType, WordTiming } from '../../lib/types';

// Volume curve that ducks the music bed under VO. We don't have a real DAW
// envelope in v1; we approximate by checking "is a VO word playing right now,
// plus a short pre/post pad". This gives a serviceable ducked feel — swap for
// a real sidechain compressor in v2.
function volumeAtTime(
  t: number,
  words: WordTiming[],
  baseVolume: number,
  duckedVolume: number,
): number {
  if (words.length === 0) return baseVolume;
  const pad = 0.25; // seconds of duck before/after a VO word
  // Binary search would be nicer; linear is fine for few thousand words.
  for (const w of words) {
    if (t >= w.start - pad && t <= w.end + pad) return duckedVolume;
    if (w.start - pad > t) break; // sorted; no later word can match
  }
  return baseVolume;
}

export const MusicBed: React.FC<{
  bed: MusicBedType;
  voWords: WordTiming[];
}> = ({ bed, voWords }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const vol = volumeAtTime(t, voWords, bed.volume, bed.duckedVolume);
  return <Audio src={bed.url} volume={vol} loop />;
};

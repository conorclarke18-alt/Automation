import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { WordTiming } from '../../lib/types';

// Groups word timings into short phrase windows so the caption doesn't flicker
// every word. Documentary style: 3–6 words at a time, held ~1–1.5s.
function groupIntoPhrases(words: WordTiming[], maxWordsPerPhrase = 5) {
  const phrases: { start: number; end: number; text: string }[] = [];
  let bucket: WordTiming[] = [];
  for (const w of words) {
    bucket.push(w);
    const terminal = /[.!?]$/.test(w.word.trim());
    if (bucket.length >= maxWordsPerPhrase || terminal) {
      phrases.push({
        start: bucket[0].start,
        end: bucket[bucket.length - 1].end,
        text: bucket.map((b) => b.word).join(' '),
      });
      bucket = [];
    }
  }
  if (bucket.length) {
    phrases.push({
      start: bucket[0].start,
      end: bucket[bucket.length - 1].end,
      text: bucket.map((b) => b.word).join(' '),
    });
  }
  return phrases;
}

export const Captions: React.FC<{ words: WordTiming[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const phrases = groupIntoPhrases(words);
  const active = phrases.find((p) => t >= p.start && t <= p.end);
  if (!active) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 80,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 54,
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
            padding: '14px 28px',
            backgroundColor: 'rgba(0,0,0,0.65)',
            borderRadius: 10,
            maxWidth: '80%',
            lineHeight: 1.2,
            textShadow: '0 2px 6px rgba(0,0,0,0.6)',
          }}
        >
          {active.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

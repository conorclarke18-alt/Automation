import {
  Chapter,
  FootageAsset,
  Project,
  ScriptBeat,
  TimelineClip,
} from './types';

// Given the VO word timings and script beats, decide start/end seconds for
// each beat. We align by cumulative word count in each beat.
export function computeBeatSpans(
  project: Project,
): Array<{ beat: ScriptBeat; start: number; end: number }> {
  const beats = project.scriptBeats;
  const words = project.voiceover?.words ?? [];
  if (beats.length === 0 || words.length === 0) return [];

  const spans: Array<{ beat: ScriptBeat; start: number; end: number }> = [];
  let cum = 0;
  for (const beat of beats) {
    const n = beat.text.split(/\s+/).filter(Boolean).length;
    const firstIdx = Math.min(words.length - 1, cum);
    const lastIdx = Math.min(words.length - 1, cum + n - 1);
    spans.push({
      beat,
      start: words[firstIdx]?.start ?? 0,
      end: words[lastIdx]?.end ?? words.at(-1)?.end ?? 0,
    });
    cum += n;
  }
  return spans;
}

// Break a beat span into ~6–9s clip slots so we hit the Fern-style cuts/min
// target without losing sync with the script structure.
function sliceSpanIntoSlots(
  start: number,
  end: number,
  targetLen = 7,
): Array<{ start: number; durationSec: number }> {
  const total = Math.max(0, end - start);
  if (total <= targetLen * 1.4) {
    return [{ start, durationSec: total }];
  }
  const nSlots = Math.max(1, Math.round(total / targetLen));
  const slotLen = total / nSlots;
  const out: Array<{ start: number; durationSec: number }> = [];
  for (let i = 0; i < nSlots; i++) {
    out.push({ start: start + i * slotLen, durationSec: slotLen });
  }
  return out;
}

// Populate a timeline by assigning a pool of footage assets to beat slots in
// round-robin fashion. Stills get Ken Burns, videos get the source mid-section.
export function populateTimeline(
  project: Project,
  pool: FootageAsset[],
): { clips: TimelineClip[]; chapters: Chapter[] } {
  if (pool.length === 0) return { clips: [], chapters: [] };
  const spans = computeBeatSpans(project);
  if (spans.length === 0) return { clips: [], chapters: [] };

  const clips: TimelineClip[] = [];
  const chapters: Chapter[] = [];
  let assetIdx = 0;
  let clipN = 0;

  for (const span of spans) {
    if (span.beat.chapter) {
      chapters.push({
        id: `ch-${chapters.length}`,
        start: span.start,
        title: span.beat.text,
      });
    }
    const slots = sliceSpanIntoSlots(span.start, span.end);
    for (const slot of slots) {
      const asset = pool[assetIdx % pool.length];
      assetIdx++;
      const isVideo = asset.kind === 'video';
      const srcOffset =
        isVideo && asset.durationSec && asset.durationSec > slot.durationSec
          ? Math.max(0, (asset.durationSec - slot.durationSec) / 2)
          : 0;
      clips.push({
        id: `clip-${clipN++}`,
        asset,
        start: slot.start,
        durationSec: slot.durationSec,
        sourceOffsetSec: srcOffset,
        kenBurns: isVideo
          ? null
          : {
              from: { scale: 1.0, x: 0, y: 0 },
              // Alternate subtle push / pull / pan for variety.
              to: kbVariant(clipN),
            },
      });
    }
  }
  return { clips, chapters };
}

function kbVariant(i: number): { scale: number; x: number; y: number } {
  const variants = [
    { scale: 1.12, x: 0, y: 0 },
    { scale: 1.08, x: -2, y: 0 },
    { scale: 1.15, x: 2, y: -1 },
    { scale: 1.06, x: 0, y: 1 },
  ];
  return variants[i % variants.length];
}

// Format chapters as a YouTube description block: `00:00 Title`.
export function chaptersToYouTubeDescription(chapters: Chapter[]): string {
  return chapters
    .map((c) => `${formatHMS(c.start)} ${c.title}`)
    .join('\n');
}

function formatHMS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

// Parse a pasted script into beats, using blank lines as beat breaks and
// ALL-CAPS / leading `#` lines as chapters. Lines ending in `[claim]` are
// flagged for citation.
export function parseScriptToBeats(raw: string): ScriptBeat[] {
  const chunks = raw
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
  return chunks.map((c, i) => {
    let text = c;
    let chapter = false;
    let claim = false;
    if (/^#\s+/.test(text)) {
      chapter = true;
      text = text.replace(/^#\s+/, '');
    } else if (/^[A-Z0-9 ,.'":!?-]{12,}$/.test(text) && text === text.toUpperCase()) {
      chapter = true;
    }
    if (/\[claim\]\s*$/i.test(text)) {
      claim = true;
      text = text.replace(/\[claim\]\s*$/i, '').trim();
    }
    return {
      id: `beat-${i}`,
      text,
      chapter,
      claim,
    };
  });
}

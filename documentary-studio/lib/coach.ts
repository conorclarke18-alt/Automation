import type { Project, ScriptBeat, WordTiming } from './types';

export type CoachSeverity = 'ok' | 'warn' | 'fail';

export type CoachFinding = {
  id: string;
  category:
    | 'hook'
    | 'pacing'
    | 're-hook'
    | 'citations'
    | 'length'
    | 'structure'
    | 'audio';
  severity: CoachSeverity;
  title: string;
  detail: string;
  // Optional timestamp the finding refers to, in seconds.
  at?: number;
};

export type CoachReport = {
  findings: CoachFinding[];
  scores: {
    overall: number; // 0..100
    hook: number;
    pacing: number;
    rehook: number;
    citations: number;
  };
  metrics: {
    runtimeSec: number;
    cutsPerMinute: number;
    avgClipDurationSec: number;
    longestClipSec: number;
    claimsWithoutCitation: number;
    wordsPerMinute: number;
  };
};

// Heuristics calibrated to Fern-style long-form docs on YouTube:
// - Cold-open hook in the first 15s that poses a question / stakes / mystery
// - Cuts per minute: 8–15 (too few = slideshow, too many = frantic)
// - Re-hook every 60–90s (a question, a jump in stakes, a reveal)
// - Every factual claim should show a source citation on-screen
// - Optimal runtime 8–20 min for algorithmic push; 20–40 min if deep dive
const HOOK_WINDOW_SEC = 15;
const TARGET_CPM_MIN = 8;
const TARGET_CPM_MAX = 15;
const REHOOK_MAX_GAP_SEC = 90;

const hookWords = [
  'why',
  'how',
  'what if',
  'imagine',
  'nobody',
  'secret',
  'truth',
  'never',
  'until',
  'but',
  'warning',
  'hidden',
  'collapsed',
  'vanished',
  'murdered',
  'stolen',
  'missing',
  'disappeared',
  'killed',
  'destroyed',
  'the only',
  'the real',
  'inside',
  'they said',
];

export function analyzeProject(project: Project): CoachReport {
  const findings: CoachFinding[] = [];
  const words: WordTiming[] = project.voiceover?.words ?? [];
  const runtimeSec =
    project.totalDurationSec ||
    project.voiceover?.durationSec ||
    (project.clips.at(-1)
      ? (project.clips.at(-1)!.start + project.clips.at(-1)!.durationSec)
      : 0);

  // ---------------- Hook (first 15s of script/VO) ----------------
  const firstBeat: ScriptBeat | undefined = project.scriptBeats[0];
  const firstBeatText = (firstBeat?.text ?? '').toLowerCase();
  const hasHookPhrase =
    hookWords.some((w) => firstBeatText.includes(w)) ||
    /\?/.test(firstBeatText);
  const openingVO = words.filter((w) => w.end <= HOOK_WINDOW_SEC);
  const openingWordCount = openingVO.length;

  let hookScore = 50;
  if (hasHookPhrase) hookScore += 25;
  if (openingWordCount >= 20 && openingWordCount <= 45) hookScore += 15;
  if (firstBeat && /\b(in \d{4}|on [a-z]+ \d+,)/i.test(firstBeat.text))
    hookScore += 10; // date specificity reads as documentary
  hookScore = Math.min(100, hookScore);

  if (!hasHookPhrase) {
    findings.push({
      id: 'hook-no-phrase',
      category: 'hook',
      severity: 'warn',
      title: 'Cold open lacks a hook phrase',
      detail:
        'Your first beat doesn\'t pose a question or plant a mystery. Fern-style openings almost always pose an unresolved question in the first sentence.',
      at: 0,
    });
  }
  if (openingWordCount > 0 && openingWordCount < 20) {
    findings.push({
      id: 'hook-too-short',
      category: 'hook',
      severity: 'warn',
      title: 'Opening VO is sparse',
      detail: `Only ${openingWordCount} words in the first ${HOOK_WINDOW_SEC}s. Dense setup keeps viewers past the skip point.`,
      at: 0,
    });
  }
  if (openingWordCount > 55) {
    findings.push({
      id: 'hook-too-dense',
      category: 'hook',
      severity: 'warn',
      title: 'Opening VO is a wall of text',
      detail:
        'More than ~55 words in the first 15s leaves no breathing room for B-roll to land. Trim the opening.',
      at: 0,
    });
  }

  // ---------------- Pacing (cuts per minute) ----------------
  const totalClips = project.clips.length;
  const runtimeMin = runtimeSec / 60;
  const cpm = runtimeMin > 0 ? totalClips / runtimeMin : 0;
  let pacingScore = 60;
  if (cpm >= TARGET_CPM_MIN && cpm <= TARGET_CPM_MAX) pacingScore = 95;
  else if (cpm >= TARGET_CPM_MIN - 2 && cpm <= TARGET_CPM_MAX + 3)
    pacingScore = 75;
  else pacingScore = Math.max(25, 60 - Math.abs(cpm - 11) * 5);

  if (totalClips > 0) {
    if (cpm < TARGET_CPM_MIN) {
      findings.push({
        id: 'pacing-slow',
        category: 'pacing',
        severity: 'warn',
        title: `Pacing slow (${cpm.toFixed(1)} cuts/min)`,
        detail: `Fern-style target is ${TARGET_CPM_MIN}–${TARGET_CPM_MAX} cuts/min. Break long clips and add archival B-roll.`,
      });
    } else if (cpm > TARGET_CPM_MAX) {
      findings.push({
        id: 'pacing-frantic',
        category: 'pacing',
        severity: 'warn',
        title: `Pacing frantic (${cpm.toFixed(1)} cuts/min)`,
        detail: `Above ${TARGET_CPM_MAX} cuts/min starts feeling TikTok-ish. Let a few shots breathe.`,
      });
    }
  }

  const durations = project.clips.map((c) => c.durationSec);
  const longestClipSec = durations.length ? Math.max(...durations) : 0;
  const avgClipDurationSec =
    durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

  if (longestClipSec > 15) {
    findings.push({
      id: 'pacing-long-clip',
      category: 'pacing',
      severity: 'warn',
      title: 'A single clip runs over 15s',
      detail:
        'Holding one shot for 15s+ kills retention in long-form. Break it with a cutaway or Ken Burns push.',
    });
  }

  // ---------------- Re-hooks (script beats vs gaps) ----------------
  let rehookScore = 80;
  let lastRehookAt = 0;
  let worstGap = 0;
  const beatTimes = estimateBeatTimes(project);
  for (let i = 1; i < beatTimes.length; i++) {
    const beat = project.scriptBeats[i];
    const t = beatTimes[i];
    if (!beat) continue;
    const lower = beat.text.toLowerCase();
    const isRehook =
      beat.chapter ||
      hookWords.some((w) => lower.includes(w)) ||
      /\?/.test(lower);
    if (isRehook) {
      const gap = t - lastRehookAt;
      if (gap > worstGap) worstGap = gap;
      if (gap > REHOOK_MAX_GAP_SEC) {
        findings.push({
          id: `rehook-gap-${i}`,
          category: 're-hook',
          severity: 'warn',
          title: `Long gap without a re-hook (${Math.round(gap)}s)`,
          detail:
            'Add a question, reveal, or stakes bump every 60–90s to re-earn attention through the retention dips.',
          at: lastRehookAt,
        });
      }
      lastRehookAt = t;
    }
  }
  // Final trailing gap
  const trailingGap = runtimeSec - lastRehookAt;
  if (trailingGap > REHOOK_MAX_GAP_SEC && beatTimes.length > 1) {
    findings.push({
      id: 'rehook-trailing',
      category: 're-hook',
      severity: 'warn',
      title: 'No re-hook before the ending',
      detail: `${Math.round(trailingGap)}s of runtime after the last re-hook. Add a final twist or stakes bump.`,
      at: lastRehookAt,
    });
  }
  rehookScore = Math.max(
    30,
    100 - Math.max(0, (Math.max(worstGap, trailingGap) - REHOOK_MAX_GAP_SEC) / 2),
  );

  // ---------------- Citations ----------------
  const claimBeats = project.scriptBeats.filter((b) => b.claim);
  const lowerThirdTitles = project.lowerThirds.map((l) => l.title.toLowerCase());
  let claimsWithoutCitation = 0;
  for (const b of claimBeats) {
    const hasLt = lowerThirdTitles.some((t) =>
      t.includes(b.text.slice(0, 20).toLowerCase()),
    );
    if (!hasLt) claimsWithoutCitation++;
  }
  let citationsScore = 100;
  if (claimBeats.length > 0) {
    citationsScore = Math.round(
      100 * (1 - claimsWithoutCitation / claimBeats.length),
    );
  }
  if (claimsWithoutCitation > 0) {
    findings.push({
      id: 'citations-missing',
      category: 'citations',
      severity: claimsWithoutCitation > 2 ? 'fail' : 'warn',
      title: `${claimsWithoutCitation} claim(s) without an on-screen source`,
      detail:
        'Every factual claim should show a lower-third citation (source + date). Viewers and the algorithm both reward this.',
    });
  }

  // ---------------- Length sanity ----------------
  if (runtimeSec > 0 && runtimeSec < 60 * 5) {
    findings.push({
      id: 'length-short',
      category: 'length',
      severity: 'warn',
      title: 'Runtime under 5 min',
      detail:
        'YouTube long-form rewards 8–20 min for algorithmic push. Flesh out with context and archival B-roll.',
    });
  }
  if (runtimeSec > 60 * 40) {
    findings.push({
      id: 'length-long',
      category: 'length',
      severity: 'warn',
      title: 'Runtime over 40 min',
      detail:
        'Very long cuts can work but raise the retention bar. Consider splitting into a multi-part series.',
    });
  }

  // ---------------- Audio sanity ----------------
  if (!project.voiceover) {
    findings.push({
      id: 'audio-no-vo',
      category: 'audio',
      severity: 'fail',
      title: 'No voiceover generated yet',
      detail: 'Generate the VO to populate word timings and unlock captions.',
    });
  }
  if (!project.musicBed) {
    findings.push({
      id: 'audio-no-bed',
      category: 'audio',
      severity: 'warn',
      title: 'No music bed',
      detail:
        'A low-volume atmospheric bed is part of the Fern-style signature. Add a bed and the render will auto-duck it under VO.',
    });
  }

  const wpm =
    runtimeMin > 0 && words.length > 0 ? words.length / runtimeMin : 0;
  if (words.length > 0) {
    if (wpm < 110) {
      findings.push({
        id: 'audio-slow-vo',
        category: 'audio',
        severity: 'warn',
        title: `VO pace is slow (${wpm.toFixed(0)} wpm)`,
        detail:
          'Documentary sweet spot is ~140–170 wpm. Too slow feels draggy; speed up in ElevenLabs or tighten the script.',
      });
    } else if (wpm > 185) {
      findings.push({
        id: 'audio-fast-vo',
        category: 'audio',
        severity: 'warn',
        title: `VO pace is fast (${wpm.toFixed(0)} wpm)`,
        detail:
          'Above ~185 wpm rushes the viewer. Dial ElevenLabs speed down a touch.',
      });
    }
  }

  const overall = Math.round(
    hookScore * 0.3 +
      pacingScore * 0.25 +
      rehookScore * 0.25 +
      citationsScore * 0.2,
  );

  return {
    findings,
    scores: {
      overall,
      hook: Math.round(hookScore),
      pacing: Math.round(pacingScore),
      rehook: Math.round(rehookScore),
      citations: Math.round(citationsScore),
    },
    metrics: {
      runtimeSec,
      cutsPerMinute: Number(cpm.toFixed(2)),
      avgClipDurationSec: Number(avgClipDurationSec.toFixed(2)),
      longestClipSec: Number(longestClipSec.toFixed(2)),
      claimsWithoutCitation,
      wordsPerMinute: Number(wpm.toFixed(1)),
    },
  };
}

// Estimate when each script beat starts, using VO word timings if present,
// otherwise falling back to a words-per-minute projection.
function estimateBeatTimes(project: Project): number[] {
  const beats = project.scriptBeats;
  if (beats.length === 0) return [];
  const words = project.voiceover?.words ?? [];
  if (words.length === 0) {
    // Fallback: 150 wpm.
    const wps = 150 / 60;
    let t = 0;
    return beats.map((b) => {
      const start = t;
      const n = b.text.split(/\s+/).filter(Boolean).length;
      t += n / wps;
      return start;
    });
  }
  // Align by cumulative word counts.
  let cum = 0;
  return beats.map((b) => {
    const idx = Math.min(words.length - 1, cum);
    const start = words[idx]?.start ?? 0;
    cum += b.text.split(/\s+/).filter(Boolean).length;
    return start;
  });
}

// ---------------- Thumbnail + title generator ----------------
// Patterns drawn from videos that get 5M+ views in the Fern / doc niche.
// We don't call an LLM here — this is local, deterministic, and fast.

export function generateTitleIdeas(topic: string): string[] {
  const t = topic.trim().replace(/\.$/, '');
  return [
    `The ${t} Nobody Talks About`,
    `What Really Happened to ${t}`,
    `The ${t} Mystery`,
    `Inside ${t}`,
    `The Truth About ${t}`,
    `How ${t} Actually Works`,
    `${t}: The Full Story`,
    `The Rise and Fall of ${t}`,
    `Why ${t} Still Matters`,
    `The Forgotten History of ${t}`,
  ];
}

export function thumbnailChecklist(topic: string): {
  headline: string;
  items: { text: string; ok: boolean }[];
} {
  return {
    headline: `Thumbnail guidance for "${topic}"`,
    items: [
      { text: 'One central subject, filling 40–60% of frame', ok: false },
      { text: '3–5 words of text, high-contrast, yellow or white', ok: false },
      { text: 'Face or object with eye-line directed across the frame', ok: false },
      { text: 'Desaturated background + single accent colour', ok: false },
      { text: 'Readable at 120px wide (sidebar size)', ok: false },
      { text: 'No border or channel watermark', ok: false },
    ],
  };
}

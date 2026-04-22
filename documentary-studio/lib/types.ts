// Shared timeline data model used by the UI, Remotion compositions, and the coach.
// Keep this framework-agnostic: no React, no Next, no Remotion imports.

import { z } from 'zod';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export type Seconds = number;

export const ScriptBeatSchema = z.object({
  id: z.string(),
  // Heading text becomes a YouTube chapter if `chapter` is true.
  text: z.string(),
  chapter: z.boolean().default(false),
  // Marks an explicit claim that should show an on-screen source citation.
  claim: z.boolean().default(false),
  // Free-form notes from the writer ("dramatic pause", "B-roll: WW2 tanks", etc).
  note: z.string().optional(),
});
export type ScriptBeat = z.infer<typeof ScriptBeatSchema>;

export const WordTimingSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});
export type WordTiming = z.infer<typeof WordTimingSchema>;

export const VoiceoverSchema = z.object({
  // Relative URL under /uploads or absolute https.
  audioUrl: z.string(),
  durationSec: z.number(),
  voiceId: z.string(),
  words: z.array(WordTimingSchema),
});
export type Voiceover = z.infer<typeof VoiceoverSchema>;

export const FootageSourceEnum = z.enum([
  'pexels',
  'pixabay',
  'wikimedia',
  'openverse',
  'internet-archive',
  'upload',
]);
export type FootageSource = z.infer<typeof FootageSourceEnum>;

export const FootageKindEnum = z.enum(['video', 'image']);
export type FootageKind = z.infer<typeof FootageKindEnum>;

export const FootageAssetSchema = z.object({
  id: z.string(),
  source: FootageSourceEnum,
  kind: FootageKindEnum,
  url: z.string(),
  thumbnail: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  attribution: z.string().optional(),
  licenseUrl: z.string().optional(),
  title: z.string().optional(),
});
export type FootageAsset = z.infer<typeof FootageAssetSchema>;

export const TimelineClipSchema = z.object({
  id: z.string(),
  asset: FootageAssetSchema,
  // Absolute start on the master timeline, in seconds.
  start: z.number(),
  durationSec: z.number(),
  // For video assets – optional in-point in the source asset.
  sourceOffsetSec: z.number().default(0),
  // Ken Burns auto-applied to stills. Null means "no Ken Burns".
  kenBurns: z
    .object({
      from: z.object({ scale: z.number(), x: z.number(), y: z.number() }),
      to: z.object({ scale: z.number(), x: z.number(), y: z.number() }),
    })
    .nullable()
    .default({
      from: { scale: 1.0, x: 0, y: 0 },
      to: { scale: 1.12, x: 0, y: 0 },
    }),
  // Optional source-citation lower third to overlay on this clip.
  citation: z.string().optional(),
});
export type TimelineClip = z.infer<typeof TimelineClipSchema>;

export const LowerThirdSchema = z.object({
  id: z.string(),
  start: z.number(),
  durationSec: z.number(),
  title: z.string(),
  subtitle: z.string().optional(),
});
export type LowerThird = z.infer<typeof LowerThirdSchema>;

export const ChapterSchema = z.object({
  id: z.string(),
  // Absolute start on the master timeline, in seconds.
  start: z.number(),
  title: z.string(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const MusicBedSchema = z.object({
  url: z.string(),
  // 0..1 normal volume; we duck to `duckedVolume` under VO.
  volume: z.number().default(0.35),
  duckedVolume: z.number().default(0.12),
});
export type MusicBed = z.infer<typeof MusicBedSchema>;

export const ProjectSchema = z.object({
  title: z.string().default('Untitled Documentary'),
  scriptBeats: z.array(ScriptBeatSchema).default([]),
  voiceover: VoiceoverSchema.nullable().default(null),
  clips: z.array(TimelineClipSchema).default([]),
  lowerThirds: z.array(LowerThirdSchema).default([]),
  chapters: z.array(ChapterSchema).default([]),
  musicBed: MusicBedSchema.nullable().default(null),
  burnedCaptions: z.boolean().default(true),
  totalDurationSec: z.number().default(0),
});
export type Project = z.infer<typeof ProjectSchema>;

export const emptyProject = (): Project => ({
  title: 'Untitled Documentary',
  scriptBeats: [],
  voiceover: null,
  clips: [],
  lowerThirds: [],
  chapters: [],
  musicBed: null,
  burnedCaptions: true,
  totalDurationSec: 0,
});

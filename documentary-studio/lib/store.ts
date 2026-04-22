'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Project,
  ScriptBeat,
  Voiceover,
  TimelineClip,
  LowerThird,
  Chapter,
  MusicBed,
  FootageAsset,
  emptyProject,
} from './types';

type State = {
  project: Project;
  lastCoachRunAt: number | null;
};

type Actions = {
  setTitle: (title: string) => void;
  loadProject: (p: Project) => void;
  resetProject: () => void;

  // Script
  setScriptBeats: (beats: ScriptBeat[]) => void;
  updateBeat: (id: string, patch: Partial<ScriptBeat>) => void;

  // Voiceover
  setVoiceover: (vo: Voiceover | null) => void;

  // Clips
  addClip: (clip: TimelineClip) => void;
  updateClip: (id: string, patch: Partial<TimelineClip>) => void;
  removeClip: (id: string) => void;
  reorderClip: (id: string, newStart: number) => void;
  replaceClipAsset: (id: string, asset: FootageAsset) => void;

  // Lower thirds
  addLowerThird: (lt: LowerThird) => void;
  removeLowerThird: (id: string) => void;

  // Chapters
  setChapters: (chapters: Chapter[]) => void;

  // Music
  setMusicBed: (mb: MusicBed | null) => void;

  // Flags
  setBurnedCaptions: (v: boolean) => void;
  setTotalDuration: (sec: number) => void;

  markCoachRun: () => void;
};

export const useStudio = create<State & Actions>()(
  persist(
    (set) => ({
      project: emptyProject(),
      lastCoachRunAt: null,

      setTitle: (title) => set((s) => ({ project: { ...s.project, title } })),
      loadProject: (project) => set({ project }),
      resetProject: () => set({ project: emptyProject() }),

      setScriptBeats: (scriptBeats) =>
        set((s) => ({ project: { ...s.project, scriptBeats } })),
      updateBeat: (id, patch) =>
        set((s) => ({
          project: {
            ...s.project,
            scriptBeats: s.project.scriptBeats.map((b) =>
              b.id === id ? { ...b, ...patch } : b,
            ),
          },
        })),

      setVoiceover: (voiceover) =>
        set((s) => ({ project: { ...s.project, voiceover } })),

      addClip: (clip) =>
        set((s) => ({
          project: {
            ...s.project,
            clips: [...s.project.clips, clip].sort((a, b) => a.start - b.start),
          },
        })),
      updateClip: (id, patch) =>
        set((s) => ({
          project: {
            ...s.project,
            clips: s.project.clips.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          },
        })),
      removeClip: (id) =>
        set((s) => ({
          project: {
            ...s.project,
            clips: s.project.clips.filter((c) => c.id !== id),
          },
        })),
      reorderClip: (id, newStart) =>
        set((s) => ({
          project: {
            ...s.project,
            clips: s.project.clips
              .map((c) => (c.id === id ? { ...c, start: newStart } : c))
              .sort((a, b) => a.start - b.start),
          },
        })),
      replaceClipAsset: (id, asset) =>
        set((s) => ({
          project: {
            ...s.project,
            clips: s.project.clips.map((c) =>
              c.id === id ? { ...c, asset } : c,
            ),
          },
        })),

      addLowerThird: (lt) =>
        set((s) => ({
          project: {
            ...s.project,
            lowerThirds: [...s.project.lowerThirds, lt],
          },
        })),
      removeLowerThird: (id) =>
        set((s) => ({
          project: {
            ...s.project,
            lowerThirds: s.project.lowerThirds.filter((l) => l.id !== id),
          },
        })),

      setChapters: (chapters) =>
        set((s) => ({ project: { ...s.project, chapters } })),

      setMusicBed: (musicBed) =>
        set((s) => ({ project: { ...s.project, musicBed } })),

      setBurnedCaptions: (burnedCaptions) =>
        set((s) => ({ project: { ...s.project, burnedCaptions } })),
      setTotalDuration: (totalDurationSec) =>
        set((s) => ({ project: { ...s.project, totalDurationSec } })),

      markCoachRun: () => set({ lastCoachRunAt: Date.now() }),
    }),
    {
      name: 'documentary-studio-project',
      version: 1,
    },
  ),
);

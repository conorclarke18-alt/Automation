'use client';

import { useMemo } from 'react';
import { useStudio } from '@/lib/store';
import { Trash2, Image as ImageIcon, Film } from 'lucide-react';

export function Timeline() {
  const project = useStudio((s) => s.project);
  const removeClip = useStudio((s) => s.removeClip);

  const runtime = project.totalDurationSec || 0;
  const pxPerSec = useMemo(() => {
    if (runtime <= 0) return 20;
    const target = 2400;
    return Math.max(6, Math.min(80, target / runtime));
  }, [runtime]);

  const width = Math.max(600, runtime * pxPerSec);

  const timeMarks = useMemo(() => {
    const step = runtime > 600 ? 60 : runtime > 120 ? 30 : runtime > 30 ? 10 : 5;
    const marks: number[] = [];
    for (let t = 0; t <= runtime; t += step) marks.push(t);
    return marks;
  }, [runtime]);

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-accent" />
          <span className="font-serif text-lg">Timeline</span>
        </div>
        <div className="text-xs text-ink-400">
          {project.clips.length} clips · {formatTime(runtime)} runtime
        </div>
      </div>
      <div className="panel-body overflow-x-auto">
        <div style={{ width, minHeight: 180 }} className="relative">
          {/* Ruler */}
          <div className="h-6 relative border-b border-ink-600">
            {timeMarks.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 text-[10px] text-ink-400 pl-1"
                style={{ left: t * pxPerSec }}
              >
                <div className="h-2 w-px bg-ink-500" />
                {formatTime(t)}
              </div>
            ))}
          </div>

          {/* Chapter markers */}
          <div className="h-5 relative border-b border-ink-700">
            {project.chapters.map((c) => (
              <div
                key={c.id}
                className="absolute top-0 bottom-0 text-[10px] text-accent flex items-center pl-1"
                style={{ left: c.start * pxPerSec }}
              >
                <div className="h-full w-px bg-accent/60" />
                <span className="ml-1 truncate max-w-[160px]">▸ {c.title}</span>
              </div>
            ))}
          </div>

          {/* B-roll track */}
          <div className="h-16 relative mt-2 bg-ink-900 border border-ink-700 rounded">
            {project.clips.map((clip) => (
              <div
                key={clip.id}
                className="absolute top-1 bottom-1 rounded border border-ink-500 bg-ink-700 hover:bg-ink-600 overflow-hidden group"
                style={{
                  left: clip.start * pxPerSec,
                  width: Math.max(12, clip.durationSec * pxPerSec),
                }}
                title={`${clip.asset.title ?? clip.asset.id} (${clip.asset.source})`}
              >
                {clip.asset.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={clip.asset.thumbnail}
                    alt=""
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : null}
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[9px] bg-black/70 flex items-center gap-1">
                  {clip.asset.kind === 'image' ? (
                    <ImageIcon className="h-3 w-3" />
                  ) : (
                    <Film className="h-3 w-3" />
                  )}
                  <span className="truncate flex-1">{clip.asset.title ?? clip.asset.source}</span>
                </div>
                <button
                  onClick={() => removeClip(clip.id)}
                  className="absolute top-1 right-1 bg-black/70 rounded p-0.5 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3 text-danger" />
                </button>
              </div>
            ))}
          </div>

          {/* VO waveform placeholder */}
          <div className="h-10 relative mt-2 bg-ink-900 border border-ink-700 rounded px-2 flex items-center text-[10px] text-ink-400">
            {project.voiceover
              ? `VO · ${project.voiceover.durationSec.toFixed(1)}s · ${project.voiceover.words.length} words`
              : 'No voiceover yet'}
          </div>

          {/* Music bed */}
          <div className="h-8 relative mt-2 bg-ink-900 border border-ink-700 rounded px-2 flex items-center text-[10px] text-ink-400">
            {project.musicBed ? `Music bed · ${project.musicBed.url}` : 'No music bed'}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

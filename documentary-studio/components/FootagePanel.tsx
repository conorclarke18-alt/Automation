'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { populateTimeline } from '@/lib/auto-layout';
import type { FootageAsset } from '@/lib/types';
import { Search, Plus, Sparkles, Loader2 } from 'lucide-react';

const ALL_SOURCES = [
  'pexels',
  'pixabay',
  'wikimedia',
  'openverse',
  'internet-archive',
] as const;

export function FootagePanel() {
  const project = useStudio((s) => s.project);
  const addClip = useStudio((s) => s.addClip);
  const setChapters = useStudio((s) => s.setChapters);
  const loadProject = useStudio((s) => s.loadProject);

  const [q, setQ] = useState('');
  const [sources, setSources] = useState<Set<string>>(new Set(ALL_SOURCES));
  const [results, setResults] = useState<FootageAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const params = new URLSearchParams({
        q,
        sources: Array.from(sources).join(','),
      });
      const res = await fetch(`/api/footage/search?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleSource = (s: string) => {
    const next = new Set(sources);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSources(next);
  };

  const toggleSelected = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const addSelectedAsPool = () => {
    const pool = results.filter((r) => selected.has(r.id));
    if (pool.length === 0) return;
    const { clips, chapters } = populateTimeline(project, pool);
    // Replace existing clips/chapters with this auto-layout pass.
    loadProject({
      ...project,
      clips,
      chapters,
    });
    setChapters(chapters);
  };

  const addSingleAtEnd = (asset: FootageAsset) => {
    const lastEnd =
      project.clips.length > 0
        ? Math.max(
            ...project.clips.map((c) => c.start + c.durationSec),
          )
        : 0;
    addClip({
      id: `clip-${Date.now()}`,
      asset,
      start: lastEnd,
      durationSec: asset.kind === 'video' ? Math.min(asset.durationSec ?? 7, 8) : 6,
      sourceOffsetSec: 0,
      kenBurns:
        asset.kind === 'image'
          ? {
              from: { scale: 1.0, x: 0, y: 0 },
              to: { scale: 1.12, x: 0, y: 0 },
            }
          : null,
    });
  };

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-accent" />
          <span className="font-serif text-lg">Footage</span>
        </div>
        <div className="text-xs text-ink-400">{results.length} results</div>
      </div>
      <div className="panel-body flex flex-col gap-3 flex-1 overflow-hidden">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search archival footage, stills, b-roll…"
            className="flex-1 bg-ink-700 border border-ink-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <button className="btn btn-primary" disabled={busy} onClick={search}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={`text-xs px-2 py-1 rounded ${
                sources.has(s)
                  ? 'bg-accent text-black'
                  : 'bg-ink-700 text-ink-300 hover:bg-ink-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {err ? <div className="text-danger text-xs">{err}</div> : null}

        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
          {results.map((r) => {
            const isSelected = selected.has(r.id);
            return (
              <div
                key={r.id}
                className={`relative rounded border overflow-hidden cursor-pointer group ${
                  isSelected ? 'border-accent' : 'border-ink-600 hover:border-ink-500'
                }`}
                onClick={() => toggleSelected(r.id)}
              >
                {r.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.thumbnail}
                    alt={r.title ?? r.id}
                    className="w-full h-28 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-28 bg-ink-700 flex items-center justify-center text-[10px] text-ink-400">
                    {r.source}
                  </div>
                )}
                <div className="px-2 py-1.5 text-[10px] bg-ink-800">
                  <div className="truncate">{r.title ?? r.id}</div>
                  <div className="text-ink-400">
                    {r.source} · {r.kind}
                    {r.durationSec ? ` · ${Math.round(r.durationSec)}s` : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSingleAtEnd(r);
                  }}
                  className="absolute top-1 right-1 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Add to end of timeline"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-ink-600 pt-3">
          <div className="text-xs text-ink-400">
            {selected.size} selected · auto-layout uses all selected as a pool
          </div>
          <button
            className="btn btn-primary"
            disabled={selected.size === 0 || !project.voiceover}
            onClick={addSelectedAsPool}
            title={
              !project.voiceover
                ? 'Generate VO first so beats can be timed'
                : 'Auto-layout with selected pool'
            }
          >
            <Sparkles className="h-4 w-4" />
            Auto-layout with {selected.size}
          </button>
        </div>
      </div>
    </div>
  );
}

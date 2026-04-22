'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStudio } from '@/lib/store';
import { analyzeProject, CoachReport } from '@/lib/coach';
import { Gauge, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';

export function CoachPanel() {
  const project = useStudio((s) => s.project);
  // Re-run on every project change — the analysis is cheap and synchronous.
  const report: CoachReport = useMemo(() => analyzeProject(project), [project]);

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-accent" />
          <span className="font-serif text-lg">Documentary Coach</span>
        </div>
        <ScorePill value={report.scores.overall} />
      </div>
      <div className="panel-body flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-2">
          <MiniScore label="Hook" value={report.scores.hook} />
          <MiniScore label="Pacing" value={report.scores.pacing} />
          <MiniScore label="Re-hook" value={report.scores.rehook} />
          <MiniScore label="Sources" value={report.scores.citations} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] text-ink-400">
          <Metric label="Cuts/min" value={report.metrics.cutsPerMinute.toFixed(1)} />
          <Metric
            label="Runtime"
            value={formatTime(report.metrics.runtimeSec)}
          />
          <Metric label="VO wpm" value={report.metrics.wordsPerMinute.toFixed(0)} />
        </div>

        <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
          {report.findings.length === 0 ? (
            <div className="flex items-center gap-2 text-ok text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Looking Fern-ready. Render when you're ready.
            </div>
          ) : (
            report.findings.map((f) => <Finding key={f.id} f={f} />)
          )}
        </div>

        <TitleAndThumb topic={project.title} />
      </div>
    </div>
  );
}

function ScorePill({ value }: { value: number }) {
  const color =
    value >= 80 ? 'bg-ok/20 text-ok' : value >= 60 ? 'bg-amber-400/20 text-amber-300' : 'bg-danger/20 text-danger';
  return (
    <span className={`text-xs px-2 py-1 rounded ${color}`}>
      {value}/100
    </span>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? 'text-ok' : value >= 60 ? 'text-amber-300' : 'text-danger';
  return (
    <div className="bg-ink-700 rounded p-2">
      <div className="text-[10px] text-ink-400 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-900 border border-ink-700 rounded px-2 py-1.5">
      <div className="text-[9px] text-ink-400 uppercase">{label}</div>
      <div className="text-ink-300">{value}</div>
    </div>
  );
}

function Finding({ f }: { f: ReturnType<typeof analyzeProject>['findings'][number] }) {
  const [open, setOpen] = useState(false);
  const color =
    f.severity === 'fail'
      ? 'border-danger/50 bg-danger/10'
      : f.severity === 'warn'
        ? 'border-amber-400/40 bg-amber-400/5'
        : 'border-ok/40 bg-ok/5';
  return (
    <div className={`border rounded px-2.5 py-1.5 text-xs ${color}`}>
      <button
        className="w-full flex items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <AlertTriangle
            className={`h-3.5 w-3.5 ${
              f.severity === 'fail'
                ? 'text-danger'
                : f.severity === 'warn'
                  ? 'text-amber-300'
                  : 'text-ok'
            }`}
          />
          <span className="font-medium">{f.title}</span>
        </span>
        <ChevronDown
          className={`h-3 w-3 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="mt-1.5 text-ink-300 leading-relaxed">{f.detail}</div>
      ) : null}
    </div>
  );
}

function TitleAndThumb({ topic }: { topic: string }) {
  const [titles, setTitles] = useState<string[]>([]);
  const [thumb, setThumb] = useState<{
    headline: string;
    items: { text: string; ok: boolean }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitles([]);
    setThumb(null);
  }, [topic]);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/thumbnail-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic || 'Untitled' }),
      });
      const data = await res.json();
      setTitles(data.titles);
      setThumb(data.thumbnail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-ink-600 pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-serif">Title + thumbnail coach</div>
        <button className="btn btn-ghost text-xs py-1" onClick={run} disabled={busy}>
          {busy ? 'Generating…' : 'Generate ideas'}
        </button>
      </div>
      {titles.length > 0 ? (
        <ul className="text-xs space-y-1 mb-2">
          {titles.map((t) => (
            <li key={t} className="px-2 py-1 bg-ink-700 rounded">{t}</li>
          ))}
        </ul>
      ) : null}
      {thumb ? (
        <div className="text-xs">
          <div className="text-ink-400 mb-1">{thumb.headline}</div>
          <ul className="space-y-0.5">
            {thumb.items.map((i) => (
              <li key={i.text} className="text-ink-300">• {i.text}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

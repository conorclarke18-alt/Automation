'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { chaptersToYouTubeDescription } from '@/lib/auto-layout';
import { Download, Loader2 } from 'lucide-react';

export function RenderButton() {
  const project = useStudio((s) => s.project);
  const [status, setStatus] = useState<
    { jobId: string; status: string; progress: number; outputPath?: string; error?: string } | null
  >(null);
  const [starting, setStarting] = useState(false);

  const canRender = project.totalDurationSec > 0 && project.clips.length > 0;

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      });
      const { jobId } = await res.json();
      setStatus({ jobId, status: 'queued', progress: 0 });
      // Poll.
      const poll = async () => {
        const r = await fetch(`/api/render?id=${jobId}`);
        const j = await r.json();
        setStatus(j);
        if (j.status === 'done' || j.status === 'error') return;
        setTimeout(poll, 1500);
      };
      poll();
    } finally {
      setStarting(false);
    }
  };

  const ytDesc = chaptersToYouTubeDescription(project.chapters);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="font-serif text-lg">Export</span>
        <span className="text-xs text-ink-400">H.264 MP4 · 1080p</span>
      </div>
      <div className="panel-body flex flex-col gap-3">
        <button
          className="btn btn-primary"
          disabled={!canRender || starting || status?.status === 'running'}
          onClick={start}
          title={!canRender ? 'Generate VO and add clips first' : ''}
        >
          {starting || status?.status === 'running' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Rendering {status ? `${(status.progress * 100).toFixed(0)}%` : ''}
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Render MP4
            </>
          )}
        </button>
        {status?.status === 'done' && status.outputPath ? (
          <div className="text-xs text-ok">
            Saved to <span className="font-mono">{status.outputPath}</span>
          </div>
        ) : null}
        {status?.status === 'error' ? (
          <div className="text-xs text-danger">{status.error}</div>
        ) : null}

        {project.chapters.length > 0 ? (
          <div>
            <div className="text-xs text-ink-400 mb-1">YouTube description – chapters</div>
            <pre className="text-[11px] bg-ink-900 border border-ink-700 rounded p-2 whitespace-pre-wrap">
              {ytDesc}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

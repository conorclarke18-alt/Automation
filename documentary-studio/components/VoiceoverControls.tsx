'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { Mic, Loader2 } from 'lucide-react';

export function VoiceoverControls() {
  const project = useStudio((s) => s.project);
  const setVoiceover = useStudio((s) => s.setVoiceover);
  const setTotalDuration = useStudio((s) => s.setTotalDuration);
  const [voiceId, setVoiceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const scriptText = project.scriptBeats.map((b) => b.text).join('\n\n');

  const generate = async () => {
    if (!scriptText.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scriptText,
          voiceId: voiceId || undefined,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error || 'Generation failed');
      }
      const data = await res.json();
      setVoiceover({
        audioUrl: data.audioUrl,
        durationSec: data.durationSec,
        voiceId: data.voiceId,
        words: data.words,
      });
      setTotalDuration(data.durationSec);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-accent" />
          <span className="font-serif text-lg">Voiceover</span>
        </div>
        {project.voiceover ? (
          <span className="text-xs text-ok">
            ✓ {project.voiceover.durationSec.toFixed(1)}s · {project.voiceover.words.length} words
          </span>
        ) : (
          <span className="text-xs text-ink-400">Not generated</span>
        )}
      </div>
      <div className="panel-body flex flex-col gap-3">
        <input
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          placeholder="ElevenLabs voice ID (optional – uses default)"
          className="bg-ink-700 border border-ink-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
        {project.voiceover ? (
          <audio controls src={project.voiceover.audioUrl} className="w-full" />
        ) : null}
        <button
          className="btn btn-primary self-start"
          disabled={busy || !scriptText.trim()}
          onClick={generate}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Generate VO
            </>
          )}
        </button>
        {err ? <div className="text-danger text-xs">{err}</div> : null}
      </div>
    </div>
  );
}

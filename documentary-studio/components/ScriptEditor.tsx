'use client';

import { useMemo, useState } from 'react';
import { useStudio } from '@/lib/store';
import { parseScriptToBeats } from '@/lib/auto-layout';
import { FileText, Wand2 } from 'lucide-react';

export function ScriptEditor() {
  const project = useStudio((s) => s.project);
  const setScriptBeats = useStudio((s) => s.setScriptBeats);
  const setTitle = useStudio((s) => s.setTitle);

  const [raw, setRaw] = useState<string>(() =>
    project.scriptBeats.map((b) => (b.chapter ? `# ${b.text}` : b.text)).join('\n\n'),
  );

  const wordCount = useMemo(
    () => raw.split(/\s+/).filter(Boolean).length,
    [raw],
  );
  const estMin = (wordCount / 150).toFixed(1);

  const parse = () => {
    const beats = parseScriptToBeats(raw);
    setScriptBeats(beats);
  };

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <span className="font-serif text-lg">Script</span>
        </div>
        <div className="text-xs text-ink-400">
          {wordCount} words · ~{estMin} min at 150 wpm
        </div>
      </div>
      <div className="panel-body flex flex-col gap-3 flex-1">
        <input
          value={project.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Documentary title"
          className="bg-ink-700 border border-ink-600 rounded-md px-3 py-2 text-lg font-serif focus:outline-none focus:border-accent"
        />
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={`Paste or write your script.\n\nBlank line = new beat.\n# Heading = chapter marker.\nEnd a beat with [claim] to flag it for an on-screen citation.\n\nExample:\n\n# The Vanishing\n\nIn 1952, a ship left port and never arrived. [claim]\n\nNo wreckage was ever found.`}
          className="flex-1 min-h-[360px] bg-ink-700 border border-ink-600 rounded-md p-3 text-sm font-mono leading-relaxed focus:outline-none focus:border-accent resize-none"
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-ink-400">
            Parsed beats: <span className="text-ink-300">{project.scriptBeats.length}</span>
          </div>
          <button className="btn btn-primary" onClick={parse}>
            <Wand2 className="h-4 w-4" />
            Parse into beats
          </button>
        </div>
      </div>
    </div>
  );
}

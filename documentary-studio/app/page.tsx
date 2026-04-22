'use client';

import { ScriptEditor } from '@/components/ScriptEditor';
import { VoiceoverControls } from '@/components/VoiceoverControls';
import { FootagePanel } from '@/components/FootagePanel';
import { Timeline } from '@/components/Timeline';
import { PreviewPane } from '@/components/PreviewPane';
import { CoachPanel } from '@/components/CoachPanel';
import { RenderButton } from '@/components/RenderButton';
import { useStudio } from '@/lib/store';
import { RotateCcw } from 'lucide-react';

export default function StudioPage() {
  const resetProject = useStudio((s) => s.resetProject);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-600 px-6 py-3 flex items-center justify-between bg-ink-900">
        <div className="flex items-center gap-3">
          <div className="font-serif text-2xl">Documentary Studio</div>
          <div className="text-xs text-ink-400">
            Fern-style YouTube long-form · Remotion + ElevenLabs
          </div>
        </div>
        <button
          className="btn btn-ghost text-xs"
          onClick={() => {
            if (confirm('Reset project? This clears script, VO, and timeline.')) {
              resetProject();
            }
          }}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 p-4">
        {/* Left: Script + VO */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0">
            <ScriptEditor />
          </div>
          <VoiceoverControls />
        </div>

        {/* Center: Preview + Timeline */}
        <div className="col-span-6 flex flex-col gap-4 min-h-0">
          <PreviewPane />
          <Timeline />
          <RenderButton />
        </div>

        {/* Right: Footage + Coach */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0">
            <FootagePanel />
          </div>
          <CoachPanel />
        </div>
      </main>
    </div>
  );
}

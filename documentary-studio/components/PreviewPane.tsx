'use client';

import { Player, PlayerRef } from '@remotion/player';
import { useRef } from 'react';
import { useStudio } from '@/lib/store';
import { DocumentaryVideo } from '@/remotion/DocumentaryVideo';
import { FPS, HEIGHT, WIDTH } from '@/lib/types';

export function PreviewPane() {
  const project = useStudio((s) => s.project);
  const durationFrames = Math.max(
    FPS, // at least 1s
    Math.ceil((project.totalDurationSec || 1) * FPS),
  );
  const ref = useRef<PlayerRef>(null);

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <span className="font-serif text-lg">Preview</span>
        <span className="text-xs text-ink-400">
          {WIDTH}×{HEIGHT} · {FPS} fps
        </span>
      </div>
      <div className="panel-body">
        <div className="aspect-video bg-black rounded overflow-hidden">
          <Player
            ref={ref}
            component={DocumentaryVideo}
            inputProps={{ project }}
            durationInFrames={durationFrames}
            fps={FPS}
            compositionWidth={WIDTH}
            compositionHeight={HEIGHT}
            controls
            acknowledgeRemotionLicense
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}

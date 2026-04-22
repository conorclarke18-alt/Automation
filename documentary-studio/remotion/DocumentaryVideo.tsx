import { z } from 'zod';
import { AbsoluteFill, Sequence, Audio, useVideoConfig } from 'remotion';
import { ProjectSchema } from '../lib/types';
import { BRollClip } from './scenes/BRollClip';
import { KenBurnsStill } from './scenes/KenBurnsStill';
import { LowerThird } from './scenes/LowerThird';
import { Captions } from './scenes/Captions';
import { MusicBed } from './audio/MusicBed';

export const documentaryVideoSchema = z.object({
  project: ProjectSchema,
});

export const DocumentaryVideo: React.FC<
  z.infer<typeof documentaryVideoSchema>
> = ({ project }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* B-roll layer */}
      {project.clips.map((clip) => {
        const from = Math.round(clip.start * fps);
        const dur = Math.max(1, Math.round(clip.durationSec * fps));
        return (
          <Sequence key={clip.id} from={from} durationInFrames={dur}>
            {clip.asset.kind === 'video' ? (
              <BRollClip clip={clip} />
            ) : (
              <KenBurnsStill clip={clip} />
            )}
          </Sequence>
        );
      })}

      {/* Lower thirds (citations + titles) */}
      {project.lowerThirds.map((lt) => {
        const from = Math.round(lt.start * fps);
        const dur = Math.max(1, Math.round(lt.durationSec * fps));
        return (
          <Sequence key={lt.id} from={from} durationInFrames={dur}>
            <LowerThird title={lt.title} subtitle={lt.subtitle} />
          </Sequence>
        );
      })}

      {/* Burned captions from VO word timings */}
      {project.burnedCaptions && project.voiceover ? (
        <Captions words={project.voiceover.words} />
      ) : null}

      {/* Voiceover audio */}
      {project.voiceover ? <Audio src={project.voiceover.audioUrl} /> : null}

      {/* Music bed (simple static mix for v1; see MusicBed for ducking notes) */}
      {project.musicBed ? (
        <MusicBed
          bed={project.musicBed}
          voWords={project.voiceover?.words ?? []}
        />
      ) : null}
    </AbsoluteFill>
  );
};

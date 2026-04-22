import { Composition } from 'remotion';
import { DocumentaryVideo, documentaryVideoSchema } from './DocumentaryVideo';
import { emptyProject, FPS, HEIGHT, WIDTH } from '../lib/types';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Documentary"
        component={DocumentaryVideo}
        durationInFrames={30 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={documentaryVideoSchema}
        defaultProps={{ project: emptyProject() }}
        calculateMetadata={({ props }) => {
          const totalSec = Math.max(1, props.project.totalDurationSec || 1);
          return {
            durationInFrames: Math.ceil(totalSec * FPS),
          };
        }}
      />
    </>
  );
};

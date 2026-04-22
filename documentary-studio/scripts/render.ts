// Stand-alone render helper so you can render outside of Next (e.g., overnight batch).
//   Usage: npm run remotion:render -- path/to/project.json out/my-doc.mp4
//
// project.json is a serialized Project (see lib/types.ts).

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { ProjectSchema } from '../lib/types';

async function main() {
  const [, , projectArg, outArg] = process.argv;
  if (!projectArg) {
    console.error('Usage: tsx scripts/render.ts <project.json> [out.mp4]');
    process.exit(1);
  }
  const projectJson = await fs.readFile(path.resolve(projectArg), 'utf-8');
  const project = ProjectSchema.parse(JSON.parse(projectJson));

  const outPath = path.resolve(outArg || `out/documentary-${Date.now()}.mp4`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  console.log('Bundling…');
  const bundleLocation = await bundle({
    entryPoint: path.resolve('remotion/index.ts'),
    webpackOverride: (c) => c,
  });

  console.log('Resolving composition…');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'Documentary',
    inputProps: { project },
  });

  console.log(`Rendering → ${outPath}`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: { project },
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  ${(progress * 100).toFixed(1)}%   `);
    },
  });
  process.stdout.write('\n');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

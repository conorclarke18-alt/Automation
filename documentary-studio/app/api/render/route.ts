import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ProjectSchema } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600; // seconds – renders can be long

// In-memory render job registry. A real deploy would use Redis/S3, but for
// local use an in-memory map keyed by job id is plenty.
type Job = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number; // 0..1
  outputPath?: string;
  error?: string;
  startedAt: number;
};
const jobs = new Map<string, Job>();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ProjectSchema.safeParse(body?.project);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid project', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const jobId = `render-${Date.now()}`;
  const job: Job = { id: jobId, status: 'queued', progress: 0, startedAt: Date.now() };
  jobs.set(jobId, job);

  // Kick off render on the next tick; don't block the response.
  void runRender(job, parsed.data).catch((err) => {
    job.status = 'error';
    job.error = err instanceof Error ? err.message : String(err);
  });

  return NextResponse.json({ jobId });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const job = jobs.get(id);
  if (!job) return NextResponse.json({ error: 'unknown job' }, { status: 404 });
  return NextResponse.json(job);
}

async function runRender(job: Job, project: unknown) {
  // Lazy import so the Next route bundle stays small.
  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, selectComposition } = await import('@remotion/renderer');

  job.status = 'running';

  const outDir = path.join(process.cwd(), process.env.RENDER_OUT_DIR || 'out');
  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${job.id}.mp4`);

  const entry = path.join(process.cwd(), 'remotion', 'index.ts');

  const bundleLocation = await bundle({
    entryPoint: entry,
    webpackOverride: (c) => c,
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'Documentary',
    inputProps: { project },
  });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { project },
    concurrency: null, // Remotion picks a sensible default.
    onProgress: ({ progress }) => {
      job.progress = progress;
    },
  });

  job.status = 'done';
  job.progress = 1;
  job.outputPath = outputPath;
}

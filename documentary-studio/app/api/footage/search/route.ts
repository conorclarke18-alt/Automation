import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { FootageAsset, FootageSource } from '@/lib/types';
import { searchPexels } from '@/lib/footage-sources/pexels';
import { searchPixabay } from '@/lib/footage-sources/pixabay';
import { searchWikimedia } from '@/lib/footage-sources/wikimedia';
import { searchOpenverse } from '@/lib/footage-sources/openverse';
import { searchInternetArchive } from '@/lib/footage-sources/internet-archive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().min(1).max(200),
  sources: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? (s.split(',') as FootageSource[]).filter((x) =>
            [
              'pexels',
              'pixabay',
              'wikimedia',
              'openverse',
              'internet-archive',
            ].includes(x),
          )
        : null,
    ),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
    sources: searchParams.get('sources') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const want = new Set<FootageSource>(
    parsed.data.sources?.length
      ? parsed.data.sources
      : (['pexels', 'pixabay', 'wikimedia', 'openverse', 'internet-archive'] as FootageSource[]),
  );
  const q = parsed.data.q;

  const pexelsKey = process.env.PEXELS_API_KEY ?? '';
  const pixabayKey = process.env.PIXABAY_API_KEY ?? '';

  const tasks: Promise<FootageAsset[]>[] = [];
  if (want.has('pexels')) tasks.push(safe(() => searchPexels(q, pexelsKey)));
  if (want.has('pixabay')) tasks.push(safe(() => searchPixabay(q, pixabayKey)));
  if (want.has('wikimedia')) tasks.push(safe(() => searchWikimedia(q)));
  if (want.has('openverse')) tasks.push(safe(() => searchOpenverse(q)));
  if (want.has('internet-archive')) tasks.push(safe(() => searchInternetArchive(q)));

  const results = (await Promise.all(tasks)).flat();
  // Interleave sources so no single source dominates.
  const interleaved = interleaveBySource(results);
  return NextResponse.json({ q, results: interleaved });
}

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

function interleaveBySource(assets: FootageAsset[]): FootageAsset[] {
  const buckets = new Map<FootageSource, FootageAsset[]>();
  for (const a of assets) {
    const b = buckets.get(a.source) ?? [];
    b.push(a);
    buckets.set(a.source, b);
  }
  const out: FootageAsset[] = [];
  const queues = Array.from(buckets.values());
  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        anyLeft = true;
      }
    }
  }
  return out;
}

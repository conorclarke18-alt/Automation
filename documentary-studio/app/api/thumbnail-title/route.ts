import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateTitleIdeas, thumbnailChecklist } from '@/lib/coach';

export const runtime = 'nodejs';

const Body = z.object({ topic: z.string().min(1).max(120) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  return NextResponse.json({
    titles: generateTitleIdeas(parsed.data.topic),
    thumbnail: thumbnailChecklist(parsed.data.topic),
  });
}

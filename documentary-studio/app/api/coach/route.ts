import { NextRequest, NextResponse } from 'next/server';
import { ProjectSchema } from '@/lib/types';
import { analyzeProject } from '@/lib/coach';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ProjectSchema.safeParse(body?.project);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid project', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const report = analyzeProject(parsed.data);
  return NextResponse.json(report);
}

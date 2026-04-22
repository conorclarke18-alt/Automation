import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { synthesizeWithTimestamps } from '@/lib/elevenlabs';

export const runtime = 'nodejs';

const BodySchema = z.object({
  text: z.string().min(1).max(50_000),
  voiceId: z.string().optional(),
  modelId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ELEVENLABS_API_KEY is not set in the environment.' },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const voiceId =
    parsed.data.voiceId ||
    process.env.ELEVENLABS_DEFAULT_VOICE_ID ||
    'JBFqnCBsd6RMkjVDRZzb';
  const modelId =
    parsed.data.modelId ||
    process.env.ELEVENLABS_MODEL_ID ||
    'eleven_multilingual_v2';

  try {
    const { audioBuffer, words, durationSec } = await synthesizeWithTimestamps({
      text: parsed.data.text,
      voiceId,
      modelId,
      apiKey,
    });

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `vo-${Date.now()}.mp3`;
    await fs.writeFile(path.join(uploadsDir, filename), audioBuffer);

    return NextResponse.json({
      audioUrl: `/uploads/${filename}`,
      durationSec,
      voiceId,
      words,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

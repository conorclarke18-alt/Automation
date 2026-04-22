import type { WordTiming } from './types';

type CharTimingResponse = {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
};

// Collapse character-level timings from ElevenLabs into word timings.
export function charsToWords(alignment: CharTimingResponse['alignment']): WordTiming[] {
  const words: WordTiming[] = [];
  let buf = '';
  let start = 0;
  let end = 0;
  let open = false;

  const flush = () => {
    if (buf.trim().length > 0) {
      words.push({ word: buf.trim(), start, end });
    }
    buf = '';
    open = false;
  };

  for (let i = 0; i < alignment.characters.length; i++) {
    const ch = alignment.characters[i];
    const s = alignment.character_start_times_seconds[i];
    const e = alignment.character_end_times_seconds[i];
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (!open) {
      start = s;
      open = true;
    }
    buf += ch;
    end = e;
  }
  flush();
  return words;
}

export async function synthesizeWithTimestamps(params: {
  text: string;
  voiceId: string;
  modelId: string;
  apiKey: string;
}): Promise<{ audioBuffer: Buffer; words: WordTiming[]; durationSec: number }> {
  const { text, voiceId, modelId, apiKey } = params;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        output_format: 'mp3_44100_128',
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${detail}`);
  }
  const data = (await res.json()) as CharTimingResponse;
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  const words = charsToWords(data.alignment);
  const durationSec =
    data.alignment.character_end_times_seconds.at(-1) ??
    (words.at(-1)?.end ?? 0);
  return { audioBuffer, words, durationSec };
}

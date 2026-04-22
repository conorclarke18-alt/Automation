# Documentary Studio

A browser-based video studio for Fern-style YouTube long-form documentaries.

Script → ElevenLabs voiceover → archival B-roll (Pexels + Pixabay + Wikimedia Commons + Openverse + Internet Archive) → Remotion render → MP4 with burned captions and YouTube chapter markers.

A built-in **Documentary Coach** scores every draft on hook strength, pacing, re-hooks, source citations, and VO pace, and generates title + thumbnail ideas.

## Stack

- **Next.js 15** (App Router) – UI and API routes
- **Remotion 4** – deterministic React-based video rendering
- **ElevenLabs** `with-timestamps` – voiceover + word-level timing in one call
- **Zustand** – client state, persisted to localStorage
- **Tailwind** – styling

## Setup

Requirements: Node 20+, npm, **ffmpeg on PATH** (Remotion's renderer needs it).

```bash
cd documentary-studio
npm install
cp .env.example .env.local   # fill in keys
npm run dev                  # open http://localhost:3030
```

### API keys

| Service           | Required    | Get one                                               |
| ----------------- | ----------- | ----------------------------------------------------- |
| ElevenLabs        | Yes (VO)    | https://elevenlabs.io/app/settings/api-keys           |
| Pexels            | Optional    | https://www.pexels.com/api/                           |
| Pixabay           | Optional    | https://pixabay.com/api/docs/                         |
| Wikimedia Commons | No key      | free                                                  |
| Openverse         | No key      | free                                                  |
| Internet Archive  | No key      | free                                                  |

Without a Pexels / Pixabay key those two sources are simply skipped — the other three still work out of the box.

### FFmpeg

Remotion shells out to ffmpeg at render time. Install it once:

- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt install ffmpeg`
- Windows: https://www.gyan.dev/ffmpeg/builds/ (add the `bin` folder to PATH)

## Workflow

1. **Write the script.** Paste it into the left panel. Blank lines separate beats; `# Heading` lines become YouTube chapters; end a line with `[claim]` to flag it for an on-screen citation.
2. **Generate VO.** Click *Generate VO*. ElevenLabs returns the MP3 plus word-level timings, which populate the timeline clock.
3. **Search footage.** Type a query, tick the sources you want, hit *Search*. Ctrl/Cmd+click thumbnails to multi-select.
4. **Auto-layout.** Click *Auto-layout with N*. Selected assets are distributed across your beats at ~6–9s slots, with Ken Burns on stills and middle-section trims on videos. The coach panel updates live.
5. **Refine.** Drop individual clips in with the `+` hover button. Remove clips by hovering and clicking the trash icon.
6. **Render.** Click *Render MP4*. Progress streams back; the file lands in `out/`. Copy the auto-generated YouTube chapter description below the button into your video description.

## The Documentary Coach

All heuristics live in `lib/coach.ts`. Current rules are calibrated to high-retention YouTube long-form docs in the Fern / Johnny Harris / Kurzgesagt vein:

- **Hook (first 15s):** penalises missing question / mystery phrasing, too few or too many opening words, rewards date specificity.
- **Pacing:** target 8–15 cuts per minute. Penalises any single clip over 15s.
- **Re-hook:** at most 90s between hook phrases / chapter breaks.
- **Citations:** every beat flagged `[claim]` should have a matching lower-third.
- **Runtime:** flags <5 min and >40 min.
- **VO pace:** sweet spot 140–170 wpm.

Score weights: 30% hook / 25% pacing / 25% re-hook / 20% citations.

## Architecture notes

- `lib/types.ts` is the single source of truth. UI, Remotion compositions, the coach, and the render worker all read from the same `Project` object.
- `remotion/DocumentaryVideo.tsx` is the composition. It's a pure function of the `Project` — so what you preview in the browser (`<Player>`) renders identically on the server (`renderMedia`).
- `lib/auto-layout.ts` turns script beats + VO word timings into `TimelineClip`s. Swap in smarter shot-selection logic here (e.g. embed the script and match to footage captions) without touching any UI or render code.
- `lib/footage-sources/*.ts` each export a `searchX(query, key?)` function returning `FootageAsset[]`. Adding a new source = drop a new file and wire it in `app/api/footage/search/route.ts`.

## Headless rendering

For overnight batches or CI:

```bash
# Export the current project from the browser (DevTools ▸ Application ▸ Local Storage ▸
# documentary-studio-project) or craft your own JSON matching ProjectSchema.

npm run remotion:render -- my-project.json out/my-doc.mp4
```

## Next steps (not yet implemented)

- Cloud render via `@remotion/lambda` for minute-long renders on beefier hardware
- AI B-roll plugin (Runway / Kling / Veo) as an additional footage source
- Smarter shot-to-script matching using embeddings
- Thumbnail image generator (Canvas/Skia) beyond the current checklist
- Sidechain ducking proper (current ducking is a volume gate, fine for v1)

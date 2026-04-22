import type { FootageAsset } from '../types';

type PexelsVideoFile = {
  link: string;
  quality: string;
  file_type: string;
  width: number;
  height: number;
};
type PexelsVideo = {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string; // thumbnail
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
};
type PexelsResponse = { videos: PexelsVideo[] };

function pickBestFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  // Prefer HD mp4 ≤ 1920 wide to keep renders fast.
  const mp4 = files.filter((f) => f.file_type === 'video/mp4');
  if (mp4.length === 0) return files[0] ?? null;
  mp4.sort((a, b) => {
    const score = (f: PexelsVideoFile) =>
      f.width <= 1920 ? f.width : 3000 - f.width; // penalize >1920
    return score(b) - score(a);
  });
  return mp4[0];
}

export async function searchPexels(
  query: string,
  apiKey: string,
): Promise<FootageAsset[]> {
  if (!apiKey) return [];
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
    query,
  )}&per_page=15&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
    // Edge-friendly caching; Pexels caches well.
    next: { revalidate: 600 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as PexelsResponse;
  return data.videos
    .map((v): FootageAsset | null => {
      const file = pickBestFile(v.video_files);
      if (!file) return null;
      return {
        id: `pexels-${v.id}`,
        source: 'pexels',
        kind: 'video',
        url: file.link,
        thumbnail: v.image,
        width: file.width,
        height: file.height,
        durationSec: v.duration,
        attribution: `${v.user.name} / Pexels`,
        licenseUrl: 'https://www.pexels.com/license/',
        title: query,
      };
    })
    .filter((x): x is FootageAsset => x !== null);
}

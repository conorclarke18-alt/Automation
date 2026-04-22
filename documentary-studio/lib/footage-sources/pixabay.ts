import type { FootageAsset } from '../types';

type PixabayVideoSource = { url: string; width: number; height: number; size: number };
type PixabayVideo = {
  id: number;
  pageURL: string;
  duration: number;
  videos: {
    large?: PixabayVideoSource;
    medium?: PixabayVideoSource;
    small?: PixabayVideoSource;
    tiny?: PixabayVideoSource;
  };
  user: string;
  picture_id?: string;
};
type PixabayResponse = { hits: PixabayVideo[] };

export async function searchPixabay(
  query: string,
  apiKey: string,
): Promise<FootageAsset[]> {
  if (!apiKey) return [];
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(
    apiKey,
  )}&q=${encodeURIComponent(query)}&per_page=15&safesearch=true`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as PixabayResponse;
  return data.hits
    .map((v): FootageAsset | null => {
      const v1080 = v.videos.large ?? v.videos.medium ?? v.videos.small;
      if (!v1080) return null;
      const thumb = v.picture_id
        ? `https://i.vimeocdn.com/video/${v.picture_id}_295x166.jpg`
        : undefined;
      return {
        id: `pixabay-${v.id}`,
        source: 'pixabay',
        kind: 'video',
        url: v1080.url,
        thumbnail: thumb,
        width: v1080.width,
        height: v1080.height,
        durationSec: v.duration,
        attribution: `${v.user} / Pixabay`,
        licenseUrl: 'https://pixabay.com/service/license-summary/',
        title: query,
      };
    })
    .filter((x): x is FootageAsset => x !== null);
}

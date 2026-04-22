import type { FootageAsset } from '../types';

type OVImage = {
  id: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  creator: string;
  license: string;
  license_url?: string;
  title: string;
};
type OVResponse = { results: OVImage[] };

// Openverse aggregates CC-licensed images across many sources (Smithsonian,
// Flickr CC, NASA, museums). Great archival supplement.
export async function searchOpenverse(query: string): Promise<FootageAsset[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    query,
  )}&page_size=15&license_type=commercial,modification`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as OVResponse;
  return data.results.map((img) => ({
    id: `openverse-${img.id}`,
    source: 'openverse' as const,
    kind: 'image' as const,
    url: img.url,
    thumbnail: img.thumbnail,
    width: img.width,
    height: img.height,
    attribution: `${img.creator} (${img.license.toUpperCase()})`,
    licenseUrl: img.license_url,
    title: img.title,
  }));
}

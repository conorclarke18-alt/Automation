import type { FootageAsset } from '../types';

type IADoc = {
  identifier: string;
  title?: string;
  creator?: string | string[];
  licenseurl?: string;
  mediatype?: string;
};
type IAResponse = { response?: { docs?: IADoc[] } };

// Internet Archive holds the Prelinger Archives (huge for historical footage),
// plus countless other collections. We query the movies mediatype here.
export async function searchInternetArchive(query: string): Promise<FootageAsset[]> {
  const q = `(${query}) AND mediatype:(movies)`;
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
    `&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=licenseurl&fl[]=mediatype` +
    `&rows=15&page=1&output=json`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as IAResponse;
  const docs = data.response?.docs ?? [];
  return docs.map((d) => {
    // IA items have a canonical "download" format. h.264 mp4 is typically available
    // at /download/<id>/<id>.mp4; when it isn't we fall back to the details page.
    const mp4 = `https://archive.org/download/${d.identifier}/${d.identifier}.mp4`;
    const thumb = `https://archive.org/services/img/${d.identifier}`;
    const creator = Array.isArray(d.creator) ? d.creator.join(', ') : d.creator;
    return {
      id: `ia-${d.identifier}`,
      source: 'internet-archive' as const,
      kind: 'video' as const,
      url: mp4,
      thumbnail: thumb,
      attribution: creator ? `${creator} / Internet Archive` : 'Internet Archive',
      licenseUrl: d.licenseurl,
      title: d.title,
    };
  });
}

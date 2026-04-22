import type { FootageAsset } from '../types';

type WMQueryPage = {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    url: string;
    thumburl?: string;
    width: number;
    height: number;
    mime: string;
    extmetadata?: {
      Artist?: { value: string };
      LicenseShortName?: { value: string };
      LicenseUrl?: { value: string };
    };
  }>;
};

type WMResponse = {
  query?: { pages?: Record<string, WMQueryPage> };
};

function stripHtml(s?: string): string | undefined {
  if (!s) return undefined;
  return s.replace(/<[^>]*>/g, '').trim();
}

// Search Wikimedia Commons for historical / archival imagery.
// No API key required.
export async function searchWikimedia(query: string): Promise<FootageAsset[]> {
  const searchUrl =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrnamespace=6&gsrlimit=18&gsrsearch=${encodeURIComponent(
      query,
    )}` +
    `&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280`;

  const res = await fetch(searchUrl, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as WMResponse;
  const pages = data.query?.pages ?? {};
  const out: FootageAsset[] = [];
  for (const p of Object.values(pages)) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    const isVideo = info.mime.startsWith('video/');
    const isImage = info.mime.startsWith('image/');
    if (!isVideo && !isImage) continue;
    out.push({
      id: `wikimedia-${p.pageid}`,
      source: 'wikimedia',
      kind: isVideo ? 'video' : 'image',
      url: info.url,
      thumbnail: info.thumburl,
      width: info.width,
      height: info.height,
      attribution: stripHtml(info.extmetadata?.Artist?.value) ?? 'Wikimedia Commons',
      licenseUrl:
        info.extmetadata?.LicenseUrl?.value ??
        'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia',
      title: p.title.replace(/^File:/, ''),
    });
  }
  return out;
}

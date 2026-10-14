/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Keyless YouTube Search Client
 * Communicates with the backend /api/youtube-search endpoint
 * which queries YouTube directly to get real, topic-specific videos.
 */

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  duration?: string;
  startSeconds?: number;
}

// In-memory cache for client-side quick reuse
const clientVideoCache = new Map<string, YouTubeVideoResult[]>();

/**
 * Fetch real, topic-specific YouTube videos from backend
 */
export async function searchYouTubeKeyless(query: string, excludeVideoIds: string[] = []): Promise<YouTubeVideoResult[]> {
  const cacheKey = query.trim().toLowerCase();
  const cached = clientVideoCache.get(cacheKey);
  if (cached && cached.length > 0) {
    const filtered = cached.filter((v) => !excludeVideoIds.includes(v.videoId));
    if (filtered.length > 0) return filtered;
  }

  try {
    const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query.trim())}`);
    if (res.ok) {
      const data = await res.json();
      if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
        clientVideoCache.set(cacheKey, data.videos);
        const filtered = data.videos.filter((v: YouTubeVideoResult) => !excludeVideoIds.includes(v.videoId));
        return filtered.length > 0 ? filtered : data.videos;
      }
    }
  } catch (err) {
    console.error('Client YouTube search error:', err);
  }

  return [];
}

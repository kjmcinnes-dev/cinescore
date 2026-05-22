// Return the best available poster URL.
// media.themoviedb.org and image.tmdb.org are public CDNs — no CORS, no proxy needed.
// Letterboxd (a.ltrbxd.com) blocks browser requests — route through backend proxy.
export function posterUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  // TMDB media CDN — load directly, no proxy needed
  if (rawUrl.startsWith("https://media.themoviedb.org") || rawUrl.startsWith("https://image.tmdb.org")) {
    return rawUrl;
  }
  // Letterboxd CDN — proxy through backend
  if (rawUrl.startsWith("https://a.ltrbxd.com")) {
    return `/api/poster?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

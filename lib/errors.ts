/* ---------- Telling "no connection" apart from a real error ----------
   A request that never reached the server rejects with a TypeError whose text
   is the browser's own: "Load failed" (Safari), "Failed to fetch" (Chrome),
   "NetworkError when attempting to fetch resource." (Firefox). supabase-js
   passes it on as "TypeError: Load failed", and lib/api wraps that in an Error
   unchanged — which is what reached the screen, for a sponsor on a train with
   no signal. Auth and edge-function calls name their own wrappers. */
const OFFLINE =
  /failed to fetch|load failed|networkerror|network request failed|network connection was lost|internet connection appears to be offline|fetch failed|failed to send a request|retryablefetcherror|functionsfetcherror/i;

export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const err = e as { name?: unknown; message?: unknown } | null | undefined;
  const text = `${err?.name ?? ""} ${err?.message ?? String(e ?? "")}`;
  return OFFLINE.test(text);
}

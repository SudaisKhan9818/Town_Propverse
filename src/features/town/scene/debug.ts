// debug.ts — QA hooks (window.__propverseTown, budget logs) are active in
// development, or in any build when the URL contains `?townDebug`.

export function isTownDebug(): boolean {
  if (typeof window === 'undefined') return false;
  return process.env.NODE_ENV !== 'production' || window.location.search.includes('townDebug');
}

/** Trim, normalise dash/"to" ranges, and cap at session seed length. */
export function normaliseRepsTarget(raw: string): string {
  let value = raw.trim();
  value = value.replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2');
  value = value.replace(/(\d)\s+to\s+(\d)/gi, '$1-$2');
  return value.slice(0, 40);
}

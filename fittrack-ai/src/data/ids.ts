/**
 * Deterministic row ids for tables with one row per user per natural key
 * (for example one weight log per date). Two devices that create "the same"
 * row offline derive the same id, so the rows merge instead of colliding on the
 * unique constraint. Not a security feature: row-level security is what stops
 * one user touching another's rows.
 */

function mix(input: string, seed: number): number {
  // 32-bit FNV-1a followed by a murmur-style finaliser
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function naturalId(userId: string, table: string, key: string): string {
  const input = `${userId}|${table}|${key}`;
  const hex = [0x1b873593, 0xcc9e2d51, 0x9e3779b9, 0x7f4a7c15]
    .map((seed) => mix(input, seed).toString(16).padStart(8, '0'))
    .join('')
    .split('');
  hex[12] = '8'; // version 8: custom, name-based
  hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16); // RFC 4122 variant
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

import { createHash } from 'node:crypto'

/**
 * A delay in [0, windowMs) derived from the hostname, so that hosts spread
 * their start over the window and a host's restarts don't reshuffle it.
 */
export function jitterDelayMs(hostname: string, windowMs: number): number {
  if (windowMs <= 0) return 0
  const hash = createHash('sha256').update(hostname).digest()
  return hash.readUIntBE(0, 6) % Math.floor(windowMs)
}

/**
 * Exponential backoff, baseMs × 2^attempts capped at capMs, then jittered by
 * up to ±20%.
 */
export function backoffMs(
  attempts: number,
  baseMs: number,
  capMs: number,
  random: () => number = Math.random,
): number {
  const ms = Math.min(capMs, baseMs * 2 ** Math.max(0, attempts))
  return Math.round(ms * (1 + (random() * 2 - 1) * 0.2))
}

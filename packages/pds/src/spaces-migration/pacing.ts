/**
 * A random delay in [0, windowMs) to spread hosts' publishing starts.
 */
export function jitterDelayMs(
  windowMs: number,
  random: () => number = Math.random,
): number {
  if (windowMs <= 0) return 0
  return Math.floor(random() * windowMs)
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

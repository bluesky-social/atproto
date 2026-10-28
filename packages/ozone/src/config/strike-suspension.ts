import assert from 'node:assert'

export type StrikeSuspensionConfig = Record<number, number>

/** Parse the UI's strike-count:suspension-hours map, including permanent bans. */
export function parseStrikeSuspensionConfig(
  value = '',
): StrikeSuspensionConfig {
  const durations: StrikeSuspensionConfig = {}
  if (!value.trim()) return durations
  for (const pair of value.split(',')) {
    const parts = pair.split(':').map((part) => part.trim())
    const count = Number(parts[0])
    const hours = Number(parts[1])
    assert(
      parts.length === 2 &&
        Number.isSafeInteger(count) &&
        count > 0 &&
        hours > 0 &&
        (Number.isFinite(hours) || parts[1] === 'Infinity'),
      `Invalid NEXT_PUBLIC_STRIKE_SUSPENSION_CONFIG entry: ${pair}`,
    )
    durations[count] = hours
  }
  return durations
}

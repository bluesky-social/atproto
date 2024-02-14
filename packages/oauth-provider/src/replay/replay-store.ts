import { Awaitable } from '../util/awaitable.js'

// Export all types needed to implement the ReplayStore interface
export type { Awaitable }

export interface ReplayStore {
  /**
   * Returns true if the nonce is unique within the given time frame. While not
   * strictly necessary for security purposes, the namespace should be used to
   * mitigate denial of service attacks from one client to the other.
   *
   * @param timeFrame expressed in milliseconds. Will never exceed 24 hours.
   */
  unique(
    namespace: string,
    nonce: string,
    timeFrame: number,
  ): Awaitable<boolean>
}

export function isReplayStore(
  implementation: Record<string, unknown> & Partial<ReplayStore>,
): implementation is Record<string, unknown> & ReplayStore {
  return typeof implementation.unique === 'function'
}

export function asReplayStore(
  implementation?: Record<string, unknown> & Partial<ReplayStore>,
): ReplayStore {
  if (!implementation || !isReplayStore(implementation)) {
    throw new Error('Invalid ReplayStore implementation')
  }
  return implementation
}

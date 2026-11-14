export { SpaceRepoVerificationError } from '@atproto/space'

/**
 * Thrown when a repo cannot be synced incrementally from a known state (its
 * operation log is incomplete, or diverges from that state). Recover by syncing
 * the repo in full.
 */
export class RepoGapError extends Error {
  name = 'RepoGapError'
}

/**
 * Thrown when a space is not governed by one of the expected policies. The
 * space can still be managed (e.g. governed by another policy) with a
 * `SpaceManager`.
 */
export class UnsupportedSpacePolicyError extends Error {
  name = 'UnsupportedSpacePolicyError'

  constructor(
    /** The unsupported policy. */
    readonly policy: { $type: string },
  ) {
    super(`Unsupported space policy: ${policy.$type}`)
  }
}

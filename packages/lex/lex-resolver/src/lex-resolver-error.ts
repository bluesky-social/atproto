import { NSID } from '@atproto/syntax'

export class LexResolverError extends Error {
  name = 'LexResolverError'

  constructor(
    public readonly nsid: NSID,
    public readonly description = `Could not resolve Lexicon for NSID`,
    options?: ErrorOptions,
  ) {
    super(`${description} (${nsid})`, options)
  }

  static from(nsid: NSID | string, description?: string) {
    return new LexResolverError(
      typeof nsid === 'string' ? NSID.from(nsid) : nsid,
      description,
    )
  }
}

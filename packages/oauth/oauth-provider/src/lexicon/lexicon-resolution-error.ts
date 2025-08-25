import { LexiconResolutionError as LRE } from '@atproto/lexicon-resolver'

export class LexiconResolutionError extends Error {
  constructor(
    public readonly nsid: string,
    options?: ErrorOptions,
  ) {
    const cause = options?.cause
    // Make sure to always return the most informative message possible,
    // including the nsid, which @atproto/lexicon-resolver doesn't consistently
    // do, so that the client devs can properly debug issues.
    const message =
      cause != null && cause instanceof LRE
        ? cause.message.includes(nsid)
          ? cause.message
          : `${cause.message} (${nsid})`
        : `Unable to resolve lexicon ${nsid}`
    super(message, options)
  }
}

import { type LexResolver, LexResolverError } from '@atproto/lex-resolver'
import type { Nsid } from '@atproto/oauth-scopes'
import { CachedGetter, swallowStoreErrors } from '@atproto-labs/simple-store'
import { LEXICON_REFRESH_FREQUENCY } from '../oauth-constants.js'
import type { LexiconData, LexiconStore } from './lexicon-store.js'

/**
 * This utility class handles the retrieval and caching of lexicon
 * data. In particular, it handles failed retrieval attempts by returning cached
 * data.
 *
 * @private
 */
export class LexiconGetter extends CachedGetter<Nsid, LexiconData> {
  constructor(store: LexiconStore, lexResolver: LexResolver) {
    super(
      async (input, options, storedData) => {
        const now = new Date()
        const result = await lexResolver.get(input, options).catch((err) => {
          // We swallow LexiconResolutionError errors, returning potentially
          // "null" values here to avoid hammering the resolver with requests
          // for the same lexicon that is known to be unavailable. The getter
          // should be called again based on the isStale() function below.
          if (err instanceof LexResolverError) return undefined

          // Unexpected error are propagated
          throw err
        })

        return {
          // Keep original createdAt, if available
          createdAt: storedData?.createdAt ?? now,
          // Always update updatedAt
          updatedAt: now,
          // Update the data with fresh data, if available, or keep cached
          // values (if any) otherwise.
          lastSucceededAt: result ? now : storedData?.lastSucceededAt ?? null,
          uri: result ? result.uri.toString() : storedData?.uri ?? null,
          lexicon: result ? result.lexicon : storedData?.lexicon ?? null,
        }
      },
      // The lexicon store acts as a cache in front of the lexicon resolver.
      // Store failures should degrade to a cache miss (and re-resolution)
      // rather than break lexicon retrieval, so we swallow (and log) them.
      swallowStoreErrors({
        set: async (nsid, data) => store.storeLexicon(nsid, data),
        get: async (nsid) => (await store.findLexicon(nsid)) ?? undefined,
        del: async (nsid) => store.deleteLexicon(nsid),
      }),
      {
        isStale: (nsid, data) => {
          const timeSinceLastUpdate = Date.now() - data.updatedAt.getTime()
          return timeSinceLastUpdate >= LEXICON_REFRESH_FREQUENCY
        },
      },
    )
  }
}

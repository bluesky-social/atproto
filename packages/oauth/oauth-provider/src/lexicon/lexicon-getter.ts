import { LexiconResolver, resolveLexicon } from '@atproto/lexicon-resolver'
import { Nsid } from '@atproto/oauth-scopes'
import { CachedGetter } from '@atproto-labs/simple-store'
import { LEXICON_REFRESH_FREQUENCY } from '../constants.js'
import { LexiconData, LexiconStore } from './lexicon-store.js'

/**
 * This utility class handles the retrieval and caching of lexicon
 * data. In particular, it handles failed retrieval attempts by returning cached
 * data.
 *
 * @private
 */
export class LexiconGetter extends CachedGetter<Nsid, LexiconData> {
  constructor(store: LexiconStore, resolver: LexiconResolver = resolveLexicon) {
    // @TODO (?) We could either store failures in the store, or use another
    // (e.g. LRU based SimpleStoreMemory) store to cache failures, to avoid
    // hammering the resolver.

    super(
      async (nsidStr, options, storedData) => {
        const now = new Date()
        try {
          // @TODO We would want to be able to explicit that the Lexicon needs
          // to be fresh, which is not possible yet with the current interface
          // of LexiconResolver.
          const { uri, lexicon } = await resolver(nsidStr)

          return {
            createdAt: storedData?.createdAt ?? now,
            updatedAt: now,
            lastSucceededAt: now,
            uri: uri.toString(),
            lexicon: lexicon,
          }
        } catch (err) {
          if (storedData === undefined) throw err

          // Return the stored value, updating the updatedAt timestamp
          // to avoid re-fetching more than LEXICON_REFRESH_FREQUENCY.
          return {
            createdAt: storedData.createdAt,
            updatedAt: now,
            lastSucceededAt: storedData.lastSucceededAt,
            uri: storedData.uri,
            lexicon: storedData.lexicon,
          }
        }
      },
      {
        set: async (nsid, data) => {
          return store.storeLexicon(nsid, data)
        },
        get: async (nsid) => {
          const data = await store.findLexicon(nsid)
          return data === null ? undefined : data
        },
        del: async (nsid) => {
          await store.deleteLexicon(nsid)
        },
      },
      {
        isStale: (nsid, data) => {
          const timeSinceLastUpdate = Date.now() - data.updatedAt.getTime()
          return timeSinceLastUpdate >= LEXICON_REFRESH_FREQUENCY
        },
      },
    )
  }
}

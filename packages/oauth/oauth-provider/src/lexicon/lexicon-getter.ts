import { LexiconResolver, resolveLexicon } from '@atproto/lexicon-resolver'
import { NSID } from '@atproto/syntax'
import { CachedGetter } from '@atproto-labs/simple-store'
import { LEXICON_REFRESH_FREQUENCY } from '../constants.js'
import {
  LexiconData,
  LexiconStore,
  isPermissionSetLexiconDoc,
} from './lexicon-store.js'

/**
 * This utility class handles the retrieval and caching of lexicon
 * data. In particular, it handles failed retrieval attempts by returning cached
 * data.
 *
 * @private
 */
export class LexiconGetter extends CachedGetter<NSID, LexiconData> {
  constructor(store: LexiconStore, resolver: LexiconResolver = resolveLexicon) {
    super(
      async (nsid, options, storedData) => {
        const now = new Date()
        try {
          const { uri, lexicon } = await resolver(nsid)

          // @NOTE: currently, the sole purpose of this class is to retrieve
          // permission set lexicons
          if (!isPermissionSetLexiconDoc(lexicon)) {
            // @TODO Better error
            throw new Error(`${nsid} is not a permission set`)
          }

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
          return store.storeLexicon(nsid.toString(), data)
        },
        get: async (nsid) => {
          const data = await store.findLexicon(nsid.toString())
          return data === null ? undefined : data
        },
        del: async (nsid) => {
          await store.deleteLexicon(nsid.toString())
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

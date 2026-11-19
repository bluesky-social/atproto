import { isPlainObject } from '@atproto/lex-data'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { PreferenceRow } from '../../../../actor-store/preference/reader.js'
import type { AppContext } from '../../../../context.js'
import { app, com } from '../../../../lexicons/index.js'

type PreferenceStats = Omit<
  com.atproto.admin.getAccountPreferenceStats.$OutputBody,
  'did'
>

// @NOTE app.bsky.actor.putPreferences replaces this whole namespace, so its
// request body limit applies to the namespace's total size.
const NAMESPACE = 'app.bsky'

const EMPTY_BODY_BYTES = Buffer.byteLength(JSON.stringify({ preferences: [] }))

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.getAccountPreferenceStats, {
    auth: ctx.authVerifier.adminTokenOrEntrywayService,
    handler: async ({ params }) => {
      const { did } = params
      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('Account not found', 'NotFound')
      }
      const rows = await ctx.actorStore.read(did, (store) =>
        store.pref.getPreferenceRows(NAMESPACE),
      )
      return {
        encoding: 'application/json' as const,
        body: { did, ...computePreferenceStats(rows) },
      }
    },
  })
}

// Sizes come from the stored JSON, which is what getPreferences serves and a
// client sends back. Values are parsed only to count list entries, and any
// that are malformed count as empty.
function computePreferenceStats(rows: PreferenceRow[]): PreferenceStats {
  const byType = new Map<string, { count: number; bytes: number }>()
  const savedFeeds = { items: 0, pinned: 0 }
  const legacySavedFeeds = { saved: 0, pinned: 0 }
  const mutedWords = { items: 0 }
  // one comma between each pair of preferences in the body's array
  let bodyBytes = EMPTY_BODY_BYTES + Math.max(rows.length - 1, 0)

  for (const { name, valueJson } of rows) {
    const bytes = Buffer.byteLength(valueJson, 'utf8')
    bodyBytes += bytes
    const typeStats = byType.get(name)
    if (typeStats) {
      typeStats.count++
      typeStats.bytes += bytes
    } else {
      byType.set(name, { count: 1, bytes })
    }

    if (name === app.bsky.actor.defs.savedFeedsPrefV2.$type) {
      const items = arrayProp(parseJson(valueJson), 'items')
      savedFeeds.items += items.length
      savedFeeds.pinned += items.filter(
        (item) => isPlainObject(item) && item.pinned === true,
      ).length
    } else if (name === app.bsky.actor.defs.savedFeedsPref.$type) {
      const value = parseJson(valueJson)
      legacySavedFeeds.saved += arrayProp(value, 'saved').length
      legacySavedFeeds.pinned += arrayProp(value, 'pinned').length
    } else if (name === app.bsky.actor.defs.mutedWordsPref.$type) {
      mutedWords.items += arrayProp(parseJson(valueJson), 'items').length
    }
  }

  return {
    bodyBytes,
    preferenceCount: rows.length,
    byType: Array.from(byType, ([type, stats]) => ({ type, ...stats })).sort(
      (a, b) => b.bytes - a.bytes || (a.type < b.type ? -1 : 1),
    ),
    savedFeeds,
    legacySavedFeeds,
    mutedWords,
  }
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

function arrayProp(value: unknown, key: string): unknown[] {
  if (!isPlainObject(value)) return []
  const prop = value[key]
  return Array.isArray(prop) ? prop : []
}

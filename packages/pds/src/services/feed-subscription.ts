import { AtUri } from '@atproto/syntax'
import { AppContext } from '../context'

/**
 * Subscribe an account to one or more feed-generator feeds by adding them
 * to its `savedFeedsPrefV2` preference.
 *
 * Mirrors `subscribeToLists` but for feeds (type='feed', collection
 * `app.bsky.feed.generator`) — the two URI shapes are validated by
 * different collections and end up as different `items[].type` values in
 * the preference document, so they can't share a single function without
 * a runtime collection switch. Kept separate for now to keep validation
 * errors specific; a future refactor could merge them on a discriminated
 * `kind` argument.
 *
 * Used by `applyNewAccountDefaults` to auto-subscribe every new account
 * (standard signup + QuickLogin) to the feeds in
 * `ctx.cfg.wsocial.defaultSubscribeFeeds` — typically the W Social Users
 * feed. Order of `feedUris` is preserved in the resulting tab order
 * (after the `following` timeline entry, which this function repairs at
 * the front if missing).
 *
 * @param ctx - Application context.
 * @param accountDid - DID of the account to subscribe.
 * @param feedUris - Array of AT-URIs for feed-generator feeds.
 * @param pinned - Whether to pin the feeds (default: true; pinned feeds
 *                 appear as home-tab pills, unpinned ones live only in
 *                 the "My Feeds" list).
 * @returns Number of feeds successfully added (0 if all were already
 *          subscribed).
 */
export async function subscribeToFeeds(
  ctx: AppContext,
  accountDid: string,
  feedUris: string[],
  pinned = true,
): Promise<number> {
  if (feedUris.length === 0) {
    return 0
  }

  // Validate all feed URIs before touching preferences — fail fast on a
  // bad config rather than half-applying the subscriptions.
  for (const feedUri of feedUris) {
    try {
      const parsed = new AtUri(feedUri)
      if (parsed.collection !== 'app.bsky.feed.generator') {
        throw new Error(
          `Invalid feed URI: ${feedUri} (must be app.bsky.feed.generator collection)`,
        )
      }
    } catch (err) {
      throw new Error(`Invalid feed AT-URI: ${feedUri}`)
    }
  }

  // Load current preferences inside an actor-store transaction. We re-open
  // a second transaction below for the write — matches the pattern in
  // `subscribeToLists` so callers can compose multiple subscription helpers
  // without worrying about nested-transaction semantics.
  const currentPrefs = await ctx.actorStore.transact(
    accountDid,
    async (actorTxn) => {
      return actorTxn.pref.getPreferences('app.bsky', {
        hasAccessFull: true,
      })
    },
  )

  // Find existing savedFeedsPrefV2 or build a fresh one.
  const savedFeedsIndex = currentPrefs.findIndex(
    (pref: any) => pref.$type === 'app.bsky.actor.defs#savedFeedsPrefV2',
  )

  let savedFeeds: {
    $type: string
    items: Array<{
      id: string
      type: string
      value: string
      pinned: boolean
    }>
  }

  if (savedFeedsIndex >= 0) {
    const existing = currentPrefs[savedFeedsIndex]
    if ('items' in existing && Array.isArray(existing.items)) {
      savedFeeds = existing as typeof savedFeeds
    } else {
      savedFeeds = {
        $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
        items: [],
      }
    }
  } else {
    savedFeeds = {
      $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
      items: [],
    }
  }

  // Ensure the "following" timeline entry is at the front. New accounts
  // come in with no prefs at all — without this they'd boot with zero
  // pinned feeds and the next-js home would show the empty-state. Same
  // safeguard as in `subscribeToLists`.
  const existingValues = new Set(savedFeeds.items.map((item) => item.value))
  const followingAdded = !existingValues.has('following')
  if (followingAdded) {
    savedFeeds.items.unshift({
      id: `timeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'timeline',
      value: 'following',
      pinned: true,
    })
    existingValues.add('following')
  }

  // Append new feed subscriptions in the order they were supplied. This
  // is the user-visible tab order after `following`, so callers control
  // ordering by ordering the `feedUris` argument (typically driven by the
  // env var `PDS_WSOCIAL_DEFAULT_SUBSCRIBE_FEEDS`).
  let subscribedCount = 0
  for (const feedUri of feedUris) {
    if (!existingValues.has(feedUri)) {
      savedFeeds.items.push({
        id: `feed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'feed',
        value: feedUri,
        pinned,
      })
      subscribedCount++
    }
  }

  // Write back only if something actually changed (new feed added or the
  // following entry was repaired). Cheap noop otherwise.
  if (subscribedCount > 0 || followingAdded) {
    const updatedPrefs = [...currentPrefs]
    if (savedFeedsIndex >= 0) {
      updatedPrefs[savedFeedsIndex] = savedFeeds
    } else {
      updatedPrefs.push(savedFeeds)
    }

    await ctx.actorStore.transact(accountDid, async (actorTxn) => {
      await actorTxn.pref.putPreferences(updatedPrefs, 'app.bsky', {
        hasAccessFull: true,
      })
    })
  }

  return subscribedCount
}

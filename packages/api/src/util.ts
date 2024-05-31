import { AtUri } from '@atproto/syntax'
import { TID } from '@atproto/common-web'

import { AppBskyActorDefs } from './client'

export function sanitizeMutedWordValue(value: string) {
  return value
    .trim()
    .replace(/^#(?!\ufe0f)/, '')
    .replace(/[\r\n\u00AD\u2060\u200D\u200C\u200B]+/, '')
}

export function savedFeedsToUriArrays(
  savedFeeds: AppBskyActorDefs.SavedFeed[],
): {
  pinned: string[]
  saved: string[]
} {
  const pinned: string[] = []
  const saved: string[] = []

  for (const feed of savedFeeds) {
    if (feed.pinned) {
      pinned.push(feed.value)
      // saved in v1 includes pinned
      saved.push(feed.value)
    } else {
      saved.push(feed.value)
    }
  }

  return {
    pinned,
    saved,
  }
}

/**
 * Get the type of a saved feed, used by deprecated methods for backwards
 * compat. Should not be used moving forward. *Invalid URIs will throw.*
 *
 * @param uri - The AT URI of the saved feed
 */
export function getSavedFeedType(
  uri: string,
): AppBskyActorDefs.SavedFeed['type'] {
  const urip = new AtUri(uri)

  switch (urip.collection) {
    case 'app.bsky.feed.generator':
      return 'feed'
    case 'app.bsky.graph.list':
      return 'list'
    default:
      return 'unknown'
  }
}

export function validateSavedFeed(savedFeed: AppBskyActorDefs.SavedFeed) {
  new TID(savedFeed.id)

  if (['feed', 'list'].includes(savedFeed.type)) {
    const uri = new AtUri(savedFeed.value)
    const isFeed = uri.collection === 'app.bsky.feed.generator'
    const isList = uri.collection === 'app.bsky.graph.list'

    if (savedFeed.type === 'feed' && !isFeed) {
      throw new Error(
        `Saved feed of type 'feed' must be a feed, got ${uri.collection}`,
      )
    }
    if (savedFeed.type === 'list' && !isList) {
      throw new Error(
        `Saved feed of type 'list' must be a list, got ${uri.collection}`,
      )
    }
  }
}

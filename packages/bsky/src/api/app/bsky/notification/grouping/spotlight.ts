import { mapDefined } from '@atproto/common'
import type { DidString } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { app } from '../../../../../lexicons/index.js'
import {
  APPVIEW_NOTIFICATION_REASON,
  NOTIFICATION_REASON,
} from '../constants.js'
import type {
  GroupingResult,
  NotificationGroup,
  NotificationItem,
} from './grouping.js'
import {
  MAX_GROUP_SIZE,
  compareNotificationGroupsNewestFirst,
  isNotificationRead,
} from './shared.js'

const MULTI_POST_LIKE_RANGES = [
  { maxItems: 200, requiredPosts: 4 },
  { maxItems: 500, requiredPosts: 8 },
]

type SpotlightCandidate = Pick<
  NotificationGroup,
  'kind' | 'groupingKey' | 'items'
> & {
  isEligibleAfterTrimming: (
    spotlightItems: NotificationItem[],
    retainedItems: NotificationItem[],
  ) => boolean
}

export const buildSpotlight = (
  items: NotificationItem[],
  groups: NotificationGroup[],
  cursor: string | undefined,
  limit: number,
  seenAt: number | undefined,
): GroupingResult => {
  const noSpotlightPage = { groups, cursor }
  const itemCount = groups.reduce(
    (count, group) => count + group.items.length,
    0,
  )

  // Grouping consumes a continuous raw prefix, even when groups interleave.
  // items contains all fetched notifications, but grouping may stop before consuming them all;
  // itemCount counts notifications included in the ordinary groups, and pageItems contains the notifications on the page.
  const pageItems = items.slice(0, itemCount)
  const spotlight = selectMultiPostLikeSpotlight(pageItems)
  if (!spotlight) return noSpotlightPage

  const selectedItems = new Set(spotlight.items)
  const positions = new Map(pageItems.map((item, index) => [item, index]))
  const proposedGroups = mapDefined(
    [
      ...groups.map((group) => ({
        // Filtering may remove notifications from this group; build a new group with only the remaining items and their updated metadata.
        kind: group.kind,
        groupingKey: group.groupingKey,
        items: group.items.filter((item) => !selectedItems.has(item)),
      })),
      spotlight,
    ],
    (group): NotificationGroup | undefined => {
      const newest = group.items[0]
      const oldest = group.items.at(-1)
      if (!newest || !oldest) return

      // Filtering may remove notifications from this group; build a new group with only the remaining items and their updated metadata.
      return {
        kind: group.kind,
        groupingKey: group.groupingKey,
        id: newest.id,
        items: group.items,
        actorDids: group.items.map((item) => item.actorDid),
        itemCount: group.items.length,
        indexedAt: newest.raw.indexedAt,
        firstIndexedAt: oldest.raw.indexedAt,
        isRead: isNotificationRead(newest.raw.indexedAt, seenAt),
      }
    },
  ).sort(compareNotificationGroupsNewestFirst)

  let retainedItems = pageItems
  const extraGroup = proposedGroups[limit]
  if (extraGroup) {
    const cutoff = positions.get(extraGroup.items[0]!)!
    retainedItems = pageItems.slice(0, cutoff)
    cursor = pageItems[cutoff - 1]!.raw.indexedAt
    // Trimming every group at one raw position preserves the page prefix.
    for (const group of proposedGroups) {
      group.items = group.items.filter((item) => positions.get(item)! < cutoff)
      group.actorDids = group.items.map((item) => item.actorDid)
      group.itemCount = group.items.length
      const oldest = group.items.at(-1)
      if (oldest) group.firstIndexedAt = oldest.raw.indexedAt
    }
  }

  const spotlightItems = retainedItems.filter((item) => selectedItems.has(item))
  if (!spotlight.isEligibleAfterTrimming(spotlightItems, retainedItems)) {
    return noSpotlightPage
  }

  return {
    cursor,
    groups: proposedGroups.filter((group) => group.items.length > 0),
  }
}

const selectMultiPostLikeSpotlight = (
  items: NotificationItem[],
): SpotlightCandidate | undefined => {
  const range = MULTI_POST_LIKE_RANGES.find(
    ({ maxItems }) => items.length <= maxItems,
  )
  if (!range) return

  // Eligibility uses the ordinary page's volume, including after trimming.
  const { requiredPosts } = range
  const likesByTopLiker = getLikeNotificationsByTopLiker(items)
  if (likesByTopLiker.length < requiredPosts) return
  const actorDid = likesByTopLiker[0]!.actorDid
  return {
    kind: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
    groupingKey: actorDid,
    items: likesByTopLiker.slice(0, MAX_GROUP_SIZE),
    isEligibleAfterTrimming: (spotlightItems, retainedItems) =>
      // Check if after trimming it still satisfies the requirements.
      spotlightItems.length >= requiredPosts &&
      getLikeNotificationsByTopLiker(retainedItems)[0]?.actorDid === actorDid,
  }
}

const getLikeNotificationsByTopLiker = (
  items: NotificationItem[],
): NotificationItem[] => {
  const likesByActor = new Map<DidString, NotificationItem[]>()
  for (const item of items) {
    if (
      item.raw.reason !== NOTIFICATION_REASON.LIKE ||
      new AtUri(item.raw.reasonSubject).collection !== app.bsky.feed.post.$type
    ) {
      continue
    }
    const likes = likesByActor.get(item.actorDid)
    if (likes) likes.push(item)
    else likesByActor.set(item.actorDid, [item])
  }

  // Each actor likes a post once; insertion order breaks ties by newest like.
  let top: NotificationItem[] = []
  for (const likes of likesByActor.values()) {
    if (likes.length > top.length) top = likes
  }
  return top
}

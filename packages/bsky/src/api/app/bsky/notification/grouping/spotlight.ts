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

const MAX_SPOTLIGHTS = 3
const MULTI_POST_RANGES = [
  { maxItems: 200, requiredPosts: 4 },
  { maxItems: 500, requiredPosts: 8 },
]
const SPOTLIGHT_KINDS = {
  [NOTIFICATION_REASON.LIKE]: APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE,
  [NOTIFICATION_REASON.REPOST]: APPVIEW_NOTIFICATION_REASON.MULTI_POST_REPOST,
  [NOTIFICATION_REASON.LIKE_VIA_REPOST]:
    APPVIEW_NOTIFICATION_REASON.MULTI_POST_LIKE_VIA_REPOST,
  [NOTIFICATION_REASON.REPOST_VIA_REPOST]:
    APPVIEW_NOTIFICATION_REASON.MULTI_POST_REPOST_VIA_REPOST,
} as const
type SpotlightReason = keyof typeof SPOTLIGHT_KINDS
const SPOTLIGHT_REASONS = Object.keys(SPOTLIGHT_KINDS) as SpotlightReason[]

type SpotlightCandidate = Pick<
  NotificationGroup,
  'kind' | 'groupingKey' | 'items'
> & {
  isEligibleAfterTrimming: (
    spotlightItems: NotificationItem[],
    retainedItems: NotificationItem[],
  ) => boolean
}

export function buildSpotlight(
  items: NotificationItem[],
  groups: NotificationGroup[],
  cursor: string | undefined,
  limit: number,
  seenAt: number | undefined,
): GroupingResult {
  // @NOTE Try one spotlight at a time, keeping the last page where all spotlights pass validation.
  let lastGoodPage: GroupingResult = { groups, cursor }
  const itemCount = groups.reduce(
    (count, group) => count + group.items.length,
    0,
  )
  // @NOTE Grouping consumes a continuous raw prefix, even when groups interleave.
  // items contains all fetched notifications, but grouping may stop before consuming them all;
  // itemCount counts notifications included in the ordinary groups, and pageItems contains the notifications on the page.
  const pageItems = items.slice(0, itemCount)
  const positions = new Map(pageItems.map((item, index) => [item, index]))
  // @NOTE Rank each reason's top actor by full count, then recency, before capping spotlight size.
  const candidates = mapDefined(SPOTLIGHT_REASONS, (reason) =>
    selectSpotlight(pageItems, reason),
  )
    .sort(
      (left, right) =>
        right.items.length - left.items.length ||
        positions.get(left.items[0]!)! - positions.get(right.items[0]!)!,
    )
    .map((candidate) => ({
      ...candidate,
      items: candidate.items.slice(0, MAX_GROUP_SIZE),
    }))

  let lastGoodItems = pageItems
  const acceptedSpotlights: SpotlightCandidate[] = []
  for (const candidate of candidates) {
    if (acceptedSpotlights.length === MAX_SPOTLIGHTS) break
    // @NOTE 1. Tentatively add this spotlight using only notifications retained on the last accepted page.
    const candidateItems = candidate.items.filter(
      (item) => positions.get(item)! < lastGoodItems.length,
    )
    const selectedItems = new Set(candidateItems)
    const proposedGroups = mapDefined(
      [
        ...lastGoodPage.groups.map((group) => ({
          // @NOTE Filtering may remove notifications from this group; build a new group with only the remaining items and their updated metadata.
          kind: group.kind,
          groupingKey: group.groupingKey,
          items: group.items.filter((item) => !selectedItems.has(item)),
        })),
        { ...candidate, items: candidateItems },
      ],
      (group): NotificationGroup | undefined => {
        const newest = group.items[0]
        const oldest = group.items.at(-1)
        if (!newest || !oldest) return

        // @NOTE Filtering may remove notifications from this group; build a new group with only the remaining items and their updated metadata.
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

    // @NOTE 2. Trim the tentative page to the group limit without changing the saved state.
    let retainedItems = lastGoodItems
    let nextCursor = lastGoodPage.cursor
    const extraGroup = proposedGroups[limit]
    if (extraGroup) {
      const cutoff = positions.get(extraGroup.items[0]!)!
      retainedItems = lastGoodItems.slice(0, cutoff)
      nextCursor = pageItems[cutoff - 1]!.raw.indexedAt
      // @NOTE Trimming every group at one raw position preserves the page prefix.
      for (const group of proposedGroups) {
        group.items = group.items.filter(
          (item) => positions.get(item)! < cutoff,
        )
        group.actorDids = group.items.map((item) => item.actorDid)
        group.itemCount = group.items.length
        const oldest = group.items.at(-1)
        if (oldest) group.firstIndexedAt = oldest.raw.indexedAt
      }
    }

    const retained = new Set(retainedItems)
    // @NOTE 3. Reject the attempt if any spotlight fails, preserving the previously accepted page and cursor.
    const allEligible = [...acceptedSpotlights, candidate].every((spotlight) =>
      spotlight.isEligibleAfterTrimming(
        spotlight.items.filter((item) => retained.has(item)),
        retainedItems,
      ),
    )
    if (!allEligible) continue

    // @NOTE 4. Save the valid page, cursor, and remaining notifications for the next attempt.
    lastGoodPage = {
      cursor: nextCursor,
      groups: proposedGroups.filter((group) => group.items.length > 0),
    }
    lastGoodItems = retainedItems
    acceptedSpotlights.push(candidate)
  }

  return lastGoodPage
}

function selectSpotlight(
  items: NotificationItem[],
  reason: SpotlightReason,
): SpotlightCandidate | undefined {
  const range = MULTI_POST_RANGES.find(
    ({ maxItems }) => items.length <= maxItems,
  )
  if (!range) return

  // @NOTE Eligibility uses the ordinary page's volume, including after trimming.
  const { requiredPosts } = range
  const topItems = getNotificationsByTopActor(items, reason)
  if (topItems.length < requiredPosts) return
  const actorDid = topItems[0]!.actorDid
  return {
    kind: SPOTLIGHT_KINDS[reason],
    groupingKey: actorDid,
    items: topItems,
    isEligibleAfterTrimming: (spotlightItems, retainedItems) =>
      // @NOTE Check if after trimming it still satisfies the requirements.
      spotlightItems.length >= requiredPosts &&
      getNotificationsByTopActor(retainedItems, reason)[0]?.actorDid ===
        actorDid,
  }
}

function getNotificationsByTopActor(
  items: NotificationItem[],
  reason: SpotlightReason,
): NotificationItem[] {
  const collection =
    reason === NOTIFICATION_REASON.LIKE_VIA_REPOST ||
    reason === NOTIFICATION_REASON.REPOST_VIA_REPOST
      ? app.bsky.feed.repost.$type
      : app.bsky.feed.post.$type
  const itemsByActor = new Map<DidString, NotificationItem[]>()
  for (const item of items) {
    if (
      item.raw.reason !== reason ||
      new AtUri(item.raw.reasonSubject).collection !== collection
    ) {
      continue
    }
    const actorItems = itemsByActor.get(item.actorDid)
    if (actorItems) actorItems.push(item)
    else itemsByActor.set(item.actorDid, [item])
  }

  // @NOTE Each actor likes or reposts a post once per reason; insertion order breaks ties by newest notification.
  let top: NotificationItem[] = []
  for (const actorItems of itemsByActor.values()) {
    if (actorItems.length > top.length) top = actorItems
  }
  return top
}

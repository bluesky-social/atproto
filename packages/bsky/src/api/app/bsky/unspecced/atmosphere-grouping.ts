import { HOUR } from '@atproto/common'
import type { AtUriString } from '@atproto/lex'
import { app, place, site } from '../../../../lexicons/index.js'
import { uriToDid } from '../../../../util/uris.js'

type ActivityItem = app.bsky.unspecced.getAtmosphereTimeline.ActivityItem
type ActivityGroup = app.bsky.unspecced.getAtmosphereTimeline.ActivityGroup

export type TimelineActivity = {
  item: ActivityItem
  sortedAt: number
  target?: AtUriString
  groupable: boolean
}

/** Select the timeline gap and grouping window using the newer activity's age. */
export function atmosphereWindow(ageMs: number): number {
  if (ageMs < HOUR) return HOUR / 2
  if (ageMs <= 12 * HOUR) return HOUR
  if (ageMs <= 24 * HOUR) return 4 * HOUR
  return 8 * HOUR
}

/** Attach article reactions, then group remaining activities at their newest position. */
export function groupAtmosphereActivities(
  activities: TimelineActivity[],
  now: number,
): (ActivityItem | ActivityGroup)[] {
  const consumed = new Set<number>()
  const output = new Map<number, ActivityItem | ActivityGroup>()
  const articles = new Map<AtUriString, number>()
  const related = new Map<number, ActivityItem[]>()

  for (const [index, { item }] of activities.entries()) {
    if (item.collection === site.standard.document.$type) {
      articles.set(item.record.uri, index)
    }
  }
  for (const [index, { item, target }] of activities.entries()) {
    if (
      !target ||
      (item.collection !== site.standard.graph.recommend.$type &&
        item.collection !== app.bsky.feed.post.$type)
    ) {
      continue
    }
    const article = articles.get(target)
    if (article === undefined) continue
    const attachments = related.get(article)
    if (attachments) attachments.push(item)
    else related.set(article, [item])
    consumed.add(index)
  }

  const itemAt = (index: number): ActivityItem => {
    const item = activities[index].item
    const attachments = related.get(index)
    return attachments ? { ...item, relatedActivity: attachments } : item
  }

  const group = (groupBy: 'subject' | 'actor') => {
    const buckets = new Map<string, number[]>()
    for (const [index, activity] of activities.entries()) {
      if (consumed.has(index)) continue
      const value =
        groupBy === 'subject'
          ? activity.target
          : authorGroupable(activity)
            ? uriToDid(activity.item.record.uri)
            : undefined
      if (!value) continue
      const key = `${activity.item.collection}:${value}`
      const bucket = buckets.get(key)
      if (bucket) bucket.push(index)
      else buckets.set(key, [index])
    }

    for (const indices of buckets.values()) {
      let start = 0
      while (start < indices.length) {
        const firstIndex = indices[start]
        const first = activities[firstIndex]
        const window = atmosphereWindow(now - first.sortedAt)
        let end = start + 1
        while (
          end < indices.length &&
          first.sortedAt - activities[indices[end]].sortedAt <= window
        ) {
          end++
        }
        if (end - start >= 2) {
          const items: ActivityItem[] = []
          for (let offset = start; offset < end; offset++) {
            const index = indices[offset]
            items.push(itemAt(index))
            consumed.add(index)
          }
          output.set(
            firstIndex,
            app.bsky.unspecced.getAtmosphereTimeline.activityGroup.$build({
              id: `${groupBy}:${first.item.record.uri}`,
              groupBy,
              collection: first.item.collection,
              indexedAt: first.item.record.indexedAt,
              items,
              ...(groupBy === 'subject'
                ? { subject: first.target }
                : { actor: uriToDid(first.item.record.uri) }),
            }),
          )
        }
        start = end
      }
    }
  }

  group('subject')
  group('actor')

  const feed: (ActivityItem | ActivityGroup)[] = []
  for (let index = 0; index < activities.length; index++) {
    const grouped = output.get(index)
    if (grouped) feed.push(grouped)
    else if (!consumed.has(index)) feed.push(itemAt(index))
  }
  return feed
}

function authorGroupable({ item, groupable }: TimelineActivity): boolean {
  if (!groupable || item.collection === app.bsky.feed.post.$type) return false
  if (
    item.collection === site.standard.document.$type &&
    item.viewerState.subscribed
  ) {
    return false
  }
  if (item.collection === place.stream.livestream.$type) {
    return !!(
      item.view &&
      app.bsky.embed.external.viewLivestream.$isTypeOf(item.view) &&
      item.view.endedAt
    )
  }
  return true
}

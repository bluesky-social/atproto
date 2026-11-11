import { HOUR } from '@atproto/common'
import type { $Typed, AtUriString, DidString } from '@atproto/lex-schema'
import { app, site } from '../../../../lexicons/index.js'
import { uriToDid } from '../../../../util/uris.js'

type ActivityItem = app.bsky.unspecced.getAtmosphereTimeline.ActivityItem
type ActivitySubject = app.bsky.unspecced.getAtmosphereTimeline.ActivitySubject

export type TimelineEntry = $Typed<
  | ActivityItem
  | app.bsky.unspecced.getAtmosphereTimeline.ActivityAuthorGroup
  | app.bsky.unspecced.getAtmosphereTimeline.ActivitySubjectGroup
>

export type TimelineActivity = {
  item: ActivityItem
  sortedAt: number
  target?: AtUriString
  groupable: boolean
}

/** Compose presentation data only after deciding which activities need it. */
export interface TimelineHydration {
  item(activity: TimelineActivity): $Typed<ActivityItem> | undefined
  subject(activity: TimelineActivity): ActivitySubject | undefined
  profile(did: DidString): app.bsky.actor.defs.ProfileViewBasic | undefined
}

/** Select the timeline gap and grouping window using the newer activity's age. */
export function atmosphereWindow(ageMs: number): number {
  if (ageMs < HOUR) return HOUR / 2
  if (ageMs <= 12 * HOUR) return HOUR
  if (ageMs <= 24 * HOUR) return 4 * HOUR
  return 8 * HOUR
}

/** Group subjects before authors, preserving each group's newest position. */
export function groupAtmosphereActivities(
  activities: TimelineActivity[],
  now: number,
  hydration: TimelineHydration,
): TimelineEntry[] {
  const consumed = new Set<number>()
  const output = new Map<number, TimelineEntry>()
  const timeline = app.bsky.unspecced.getAtmosphereTimeline

  const group = (groupBy: 'subject' | 'actor') => {
    const buckets = new Map<string, { indices: number[]; article: boolean }>()
    for (const [index, activity] of activities.entries()) {
      if (consumed.has(index)) continue
      const article =
        groupBy === 'subject' &&
        (activity.item.collection === site.standard.document.$type ||
          activity.item.collection === site.standard.graph.recommend.$type ||
          activity.item.collection === app.bsky.feed.post.$type)
      const value =
        groupBy === 'subject'
          ? activity.item.collection === site.standard.document.$type
            ? activity.item.record.uri
            : activity.target
          : authorGroupable(activity)
            ? uriToDid(activity.item.record.uri)
            : undefined
      if (!value) continue
      const key = `${article ? 'article' : activity.item.collection}:${value}`
      const bucket = buckets.get(key)
      if (bucket) bucket.indices.push(index)
      else buckets.set(key, { indices: [index], article })
    }

    for (const { indices, article } of buckets.values()) {
      let start = 0
      while (start < indices.length) {
        const firstIndex = indices[start]
        const first = activities[firstIndex]
        const window = atmosphereWindow(now - first.sortedAt)
        let end = start + 1
        while (
          end < indices.length &&
          (article ||
            first.sortedAt - activities[indices[end]].sortedAt <= window)
        ) {
          end++
        }
        if (end - start >= 2) {
          let entry: TimelineEntry | undefined
          if (groupBy === 'subject') {
            let selected = first
            for (let offset = start; offset < end; offset++) {
              const activity = activities[indices[offset]]
              if (activity.item.collection === site.standard.document.$type) {
                selected = activity
                break
              }
              if (
                selected.item.collection === app.bsky.feed.post.$type &&
                activity.item.collection !== app.bsky.feed.post.$type
              ) {
                selected = activity
              }
            }
            const subject = hydration.subject(selected)
            if (subject) {
              const groupItems: app.bsky.unspecced.getAtmosphereTimeline.ActivityGroupItem[] =
                []
              const actors: app.bsky.actor.defs.ProfileViewBasic[] = []
              const seenActors = new Set<DidString>()
              for (let offset = start; offset < end; offset++) {
                const { item } = activities[indices[offset]]
                groupItems.push(
                  timeline.activityGroupItem.$build({
                    record: item.record,
                    collection: item.collection,
                  }),
                )
                const did = uriToDid(item.record.uri)
                if (seenActors.has(did)) continue
                seenActors.add(did)
                const profile = hydration.profile(did)
                if (profile) actors.push(profile)
              }
              entry = timeline.activitySubjectGroup.$build({
                id: `subject:${first.item.record.uri}`,
                indexedAt: first.item.record.indexedAt,
                subject,
                activities: groupItems,
                actors,
              })
            }
          } else {
            const item = hydration.item(first)
            if (item) {
              const uris: AtUriString[] = []
              for (let offset = start; offset < end; offset++) {
                uris.push(activities[indices[offset]].item.record.uri)
              }
              entry = timeline.activityAuthorGroup.$build({
                id: `actor:${first.item.record.uri}`,
                collection: first.item.collection,
                indexedAt: first.item.record.indexedAt,
                actor: uriToDid(first.item.record.uri),
                item,
                uris,
              })
            }
          }
          if (entry) {
            output.set(firstIndex, entry)
            for (let offset = start; offset < end; offset++) {
              consumed.add(indices[offset])
            }
          }
        }
        start = end
      }
    }
  }

  group('subject')
  group('actor')

  const feed: TimelineEntry[] = []
  for (let index = 0; index < activities.length; index++) {
    const grouped = output.get(index)
    if (grouped) feed.push(grouped)
    else if (!consumed.has(index)) {
      const item = hydration.item(activities[index])
      if (item) feed.push(item)
    }
  }
  return feed
}

function authorGroupable({ item, groupable }: TimelineActivity): boolean {
  return (
    groupable &&
    item.collection !== app.bsky.feed.post.$type &&
    !(
      item.collection === site.standard.document.$type &&
      item.viewerState.subscribed
    )
  )
}

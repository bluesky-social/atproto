import { HOUR } from '@atproto/common'
import type {
  $Typed,
  AtUriString,
  DidString,
  NsidString,
} from '@atproto/lex-schema'
import { app, site } from '../../../../lexicons/index.js'
import { uriToDid } from '../../../../util/uris.js'

type ActivityItem = app.bsky.unspecced.getAtmosphereTimeline.ActivityItem
type ActivitySubject = app.bsky.unspecced.getAtmosphereTimeline.ActivitySubject

export type TimelineEntry = $Typed<
  | ActivityItem
  | app.bsky.unspecced.getAtmosphereTimeline.ActivityActorGroup
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

/** Attach article actions, then group subjects and actors at their newest position. */
export function groupAtmosphereActivities(
  activities: TimelineActivity[],
  now: number,
  hydration: TimelineHydration,
): TimelineEntry[] {
  const consumed = new Set<number>()
  const output = new Map<number, TimelineEntry>()
  const timeline = app.bsky.unspecced.getAtmosphereTimeline

  const profiles = (indices: number[], start = 0, end = indices.length) => {
    const actors: app.bsky.actor.defs.ProfileViewBasic[] = []
    const seenActors = new Set<DidString>()
    for (let offset = start; offset < end; offset++) {
      const did = uriToDid(activities[indices[offset]].item.record.uri)
      if (seenActors.has(did)) continue
      seenActors.add(did)
      const profile = hydration.profile(did)
      if (!profile) return
      actors.push(profile)
    }
    return actors
  }

  const groupItems = (indices: number[], start = 0, end = indices.length) => {
    const items: app.bsky.unspecced.getAtmosphereTimeline.ActivityGroupItem[] =
      []
    for (let offset = start; offset < end; offset++) {
      const { item } = activities[indices[offset]]
      items.push(
        timeline.activityGroupItem.$build({
          record: item.record,
          collection: item.collection,
        }),
      )
    }
    return items
  }

  const documents = new Map<AtUriString, number>()
  for (const [index, { item }] of activities.entries()) {
    if (item.collection === site.standard.document.$type) {
      documents.set(item.record.uri, index)
    }
  }
  const related = new Map<number, Map<NsidString, number[]>>()
  for (const [index, activity] of activities.entries()) {
    if (
      !activity.target ||
      (activity.item.collection !== site.standard.graph.recommend.$type &&
        activity.item.collection !== app.bsky.feed.post.$type)
    ) {
      continue
    }
    const documentIndex = documents.get(activity.target)
    if (documentIndex === undefined) continue
    let buckets = related.get(documentIndex)
    if (!buckets) related.set(documentIndex, (buckets = new Map()))
    const bucket = buckets.get(activity.item.collection)
    if (bucket) bucket.push(index)
    else buckets.set(activity.item.collection, [index])
  }

  for (const [documentIndex, buckets] of related) {
    const item = hydration.item(activities[documentIndex])
    consumed.add(documentIndex)
    if (!item) continue
    const relatedActivity: app.bsky.unspecced.getAtmosphereTimeline.ActivityRelatedGroup[] =
      []
    for (const [collection, indices] of buckets) {
      const actors = profiles(indices)
      if (!actors) continue
      relatedActivity.push(
        timeline.activityRelatedGroup.$build({
          collection,
          activities: groupItems(indices),
          actors,
        }),
      )
      for (const index of indices) consumed.add(index)
    }
    output.set(
      documentIndex,
      relatedActivity.length
        ? timeline.activityItem.$build({ ...item, relatedActivity })
        : item,
    )
  }

  const group = (groupBy: 'subject' | 'actor') => {
    const buckets = new Map<string, { indices: number[]; article: boolean }>()
    for (const [index, activity] of activities.entries()) {
      if (consumed.has(index)) continue
      if (
        groupBy === 'subject' &&
        activity.item.collection === site.standard.document.$type
      ) {
        continue
      }
      const article =
        groupBy === 'subject' &&
        (activity.item.collection === site.standard.graph.recommend.$type ||
          activity.item.collection === app.bsky.feed.post.$type)
      const value =
        groupBy === 'subject'
          ? activity.target
          : !related.has(index) && actorGroupable(activity)
            ? uriToDid(activity.item.record.uri)
            : undefined
      if (!value) continue
      const key = `${activity.item.collection}:${value}`
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
            const firstActor = uriToDid(first.item.record.uri)
            let multipleActors = false
            for (let offset = start + 1; offset < end; offset++) {
              if (
                uriToDid(activities[indices[offset]].item.record.uri) !==
                firstActor
              ) {
                multipleActors = true
                break
              }
            }
            if (multipleActors) {
              const actors = profiles(indices, start, end)
              if (actors) {
                const subject = hydration.subject(first)
                if (subject) {
                  entry = timeline.activitySubjectGroup.$build({
                    id: `subject:${first.item.record.uri}`,
                    collection: first.item.collection,
                    indexedAt: first.item.record.indexedAt,
                    subject,
                    activities: groupItems(indices, start, end),
                    actors,
                  })
                }
              }
            }
          } else {
            const item = hydration.item(first)
            if (item) {
              const uris: AtUriString[] = []
              for (let offset = start; offset < end; offset++) {
                uris.push(activities[indices[offset]].item.record.uri)
              }
              entry = timeline.activityActorGroup.$build({
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

function actorGroupable({ item, groupable }: TimelineActivity): boolean {
  return (
    groupable &&
    item.collection !== app.bsky.feed.post.$type &&
    !(
      item.collection === site.standard.document.$type &&
      item.viewerState.subscribed
    )
  )
}

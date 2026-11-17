import { HOUR } from '@atproto/common'
import {
  type $Typed,
  type AtUriString,
  type DidString,
  type NsidString,
  toDatetimeString,
} from '@atproto/lex-schema'
import { app, site } from '../../../../../lexicons/index.js'

const timeline = app.bsky.unspecced.getAtmosphereTimelineV2

/** Profiles of at most this many newest actors per subject group or related collection. */
const RELATED_ACTOR_LIMIT = 3

export type TimelineEntry = $Typed<
  | app.bsky.unspecced.getAtmosphereTimelineV2.ActivityItem
  | app.bsky.unspecced.getAtmosphereTimelineV2.ActivityActorGroup
  | app.bsky.unspecced.getAtmosphereTimelineV2.ActivitySubjectGroup
>

/** A visible activity, before deciding which presentation views are needed. */
export type TimelineActivity = {
  ref: { uri: AtUriString; cid: string }
  collection: NsidString
  actor: DidString
  sortedAt: number
  /** The target's URI, or the activity's own URI when it has no target. */
  subject: AtUriString
  /** Creates content that same-page activity targeting it attaches to. */
  creation: boolean
  /** Whether this activity may join an actor group. */
  groupable: boolean
}

/** Compose subjects only for the activities whose entries need them. */
export interface TimelineHydration {
  subject(
    activity: TimelineActivity,
  ): app.bsky.unspecced.getAtmosphereTimelineV2.ActivitySubject | undefined
}

/** Select the timeline gap and grouping window using the newer activity's age. */
export function atmosphereWindow(ageMs: number): number {
  if (ageMs < HOUR) return HOUR / 2
  if (ageMs <= 12 * HOUR) return HOUR
  if (ageMs <= 24 * HOUR) return 4 * HOUR
  return 8 * HOUR
}

/**
 * Group one page of newest-first activities, by precedence: creations with
 * related activity, subject groups, actor groups, then standalone items. Each
 * entry sits at its newest activity, so the feed stays newest first.
 */
export function groupAtmosphereActivities(
  activities: TimelineActivity[],
  now: number,
  hydration: TimelineHydration,
): TimelineEntry[] {
  const consumed = new Set<number>()
  const output = new Map<number, TimelineEntry>()

  const item = (index: number, related: number[] = []) => {
    const activity = activities[index]
    const subject = hydration.subject(activity)
    if (!subject) return
    return timeline.activityItem.$build({
      ref: activity.ref,
      collection: activity.collection,
      indexedAt: indexedAt(activity),
      actor: activity.actor,
      subject,
      relatedActivity: related.length
        ? related.map((relatedIndex) => {
            const { ref, collection, actor } = activities[relatedIndex]
            return timeline.activityItemRelatedActivity.$build({
              ref,
              collection,
              indexedAt: indexedAt(activities[relatedIndex]),
              actor,
            })
          })
        : undefined,
    })
  }

  // Creations collect same-page activity targeting them and stand alone.
  const creations = new Map<AtUriString, number>()
  for (const [index, activity] of activities.entries()) {
    if (activity.creation) creations.set(activity.ref.uri, index)
  }
  const related = new Map<number, number[]>()
  for (const [index, activity] of activities.entries()) {
    if (activity.creation) continue
    const creation = creations.get(activity.subject)
    if (creation === undefined) continue
    const indices = related.get(creation)
    if (indices) indices.push(index)
    else related.set(creation, [index])
  }
  for (const [creation, indices] of related) {
    consumed.add(creation)
    for (const index of indices) consumed.add(index)
    const entry = item(creation, indices)
    if (entry) output.set(creation, entry)
  }

  const group = (groupBy: 'subject' | 'actor') => {
    const buckets = new Map<string, { indices: number[]; windowed: boolean }>()
    for (const [index, activity] of activities.entries()) {
      if (consumed.has(index)) continue
      if (groupBy === 'subject' ? activity.creation : !activity.groupable)
        continue
      const key = `${activity.collection}:${
        groupBy === 'subject' ? activity.subject : activity.actor
      }`
      const bucket = buckets.get(key)
      if (bucket) bucket.indices.push(index)
      else
        buckets.set(key, {
          indices: [index],
          // @NOTE Recommendations of an article group across the whole page.
          windowed:
            groupBy === 'actor' ||
            activity.collection !== site.standard.graph.recommend.$type,
        })
    }

    for (const { indices, windowed } of buckets.values()) {
      let start = 0
      while (start < indices.length) {
        const first = activities[indices[start]]
        const window = atmosphereWindow(now - first.sortedAt)
        let end = start + 1
        while (
          end < indices.length &&
          (!windowed ||
            first.sortedAt - activities[indices[end]].sortedAt <= window)
        ) {
          end++
        }
        const members = indices.slice(start, end)
        start = end
        if (members.length < 2) continue
        if (
          groupBy === 'subject' &&
          members.every((index) => activities[index].actor === first.actor)
        ) {
          continue
        }
        const subject = hydration.subject(first)
        if (!subject) continue
        if (groupBy === 'subject') {
          output.set(
            members[0],
            timeline.activitySubjectGroup.$build({
              collection: first.collection,
              indexedAt: indexedAt(first),
              subject,
              activities: members.map((index) =>
                timeline.activitySubjectGroupItem.$build({
                  ref: activities[index].ref,
                  indexedAt: indexedAt(activities[index]),
                  actor: activities[index].actor,
                }),
              ),
            }),
          )
        } else {
          output.set(
            members[0],
            timeline.activityActorGroup.$build({
              collection: first.collection,
              indexedAt: indexedAt(first),
              actor: first.actor,
              subjects: [subject],
              activities: members.map((index) =>
                timeline.activityActorGroupItem.$build({
                  ref: activities[index].ref,
                  indexedAt: indexedAt(activities[index]),
                  subject: activities[index].subject,
                }),
              ),
            }),
          )
        }
        for (const index of members) consumed.add(index)
      }
    }
  }

  group('subject')
  group('actor')

  const feed: TimelineEntry[] = []
  for (let index = 0; index < activities.length; index++) {
    const entry = consumed.has(index) ? output.get(index) : item(index)
    if (entry) feed.push(entry)
  }
  return feed
}

/**
 * Actors whose profiles the feed references, in feed order: each item and
 * actor-group actor, plus the newest few distinct actors of each subject group
 * and of each collection in an item's related activity.
 */
export function referencedActors(feed: TimelineEntry[]): DidString[] {
  const actors = new Set<DidString>()
  const addNewest = (dids: DidString[]) => {
    for (const did of [...new Set(dids)].slice(0, RELATED_ACTOR_LIMIT)) {
      actors.add(did)
    }
  }
  for (const entry of feed) {
    if (timeline.activitySubjectGroup.$isTypeOf(entry)) {
      addNewest(entry.activities.map(({ actor }) => actor))
      continue
    }
    actors.add(entry.actor)
    if (!timeline.activityItem.$isTypeOf(entry)) continue
    const byCollection = new Map<NsidString, DidString[]>()
    for (const { collection, actor } of entry.relatedActivity ?? []) {
      const dids = byCollection.get(collection)
      if (dids) dids.push(actor)
      else byCollection.set(collection, [actor])
    }
    for (const dids of byCollection.values()) addNewest(dids)
  }
  return [...actors]
}

function indexedAt({ sortedAt }: TimelineActivity) {
  return toDatetimeString(sortedAt)
}

import { AtUriString, DidString } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client/index.js'
import { app } from '../lexicons/index.js'
import { PollTopicRecord, PollVoteRecord } from '../views/types.js'
import { HydrationMap, ItemRef, RecordInfo, parseRecord } from './util.js'

export type Poll = RecordInfo<PollTopicRecord>
export type Polls = HydrationMap<AtUriString, Poll>

export type PollVote = RecordInfo<PollVoteRecord>
export type PollVotes = HydrationMap<AtUriString, PollVote>

export type PollAgg = {
  total: number
  // index i holds the vote count for option i
  optionCounts: number[]
}
export type PollAggs = HydrationMap<AtUriString, PollAgg>

export type PollViewerState = {
  vote?: AtUriString
  option?: number
}
export type PollViewerStates = HydrationMap<AtUriString, PollViewerState>

// keyed by `${pollUri}#${option}` -> ordered voter dids (follows first)
export type PollFacepiles = HydrationMap<string, DidString[]>

export const pollFacepileKey = (pollUri: string, option: number) =>
  `${pollUri}#${option}`

const FACEPILE_SIZE = 3

export class PollHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getPolls(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Polls> {
    const map: Polls = new HydrationMap()
    if (!uris.length) return map

    const res = await this.dataplane.getPollTopicRecords({ uris })
    for (let i = 0; i < uris.length; i++) {
      const record = parseRecord(
        app.bsky.poll.topic.main,
        res.records[i],
        includeTakedowns,
      )
      map.set(uris[i], record ?? null)
    }
    return map
  }

  async getPollVotes(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<PollVotes> {
    const map: PollVotes = new HydrationMap()
    if (!uris.length) return map

    const res = await this.dataplane.getPollVoteRecords({ uris })
    for (let i = 0; i < uris.length; i++) {
      const record = parseRecord(
        app.bsky.poll.vote.main,
        res.records[i],
        includeTakedowns,
      )
      map.set(uris[i], record ?? null)
    }
    return map
  }

  async getPollAggregates(refs: ItemRef[]): Promise<PollAggs> {
    const map: PollAggs = new HydrationMap()
    if (!refs.length) return map

    const res = await this.dataplane.getPollVoteCounts({ refs })
    for (let i = 0; i < refs.length; i++) {
      const counts = res.counts[i]
      map.set(refs[i].uri, {
        total: counts?.total ?? 0,
        optionCounts: counts ? Array.from(counts.optionCounts) : [],
      })
    }
    return map
  }

  async getPollViewerStates(
    refs: ItemRef[],
    viewer: DidString,
  ): Promise<PollViewerStates> {
    const map: PollViewerStates = new HydrationMap()
    if (!refs.length) return map

    const res = await this.dataplane.getPollVotesByActorAndSubjects({
      actorDid: viewer,
      refs,
    })
    for (let i = 0; i < refs.length; i++) {
      const vote = res.votes[i]
      map.set(refs[i].uri, {
        vote: vote?.uri ? (vote.uri as AtUriString) : undefined,
        option: vote?.uri ? vote.option : undefined,
      })
    }
    return map
  }

  // Fetches an ordered preview of voter dids per (poll, option), prioritizing
  // accounts the viewer follows. Only options with at least one vote are
  // queried (driven by `aggs`).
  async getPollFacepiles(
    polls: Polls,
    aggs: PollAggs,
    pollRefs: ItemRef[],
    viewer: DidString | null,
  ): Promise<PollFacepiles> {
    const map: PollFacepiles = new HydrationMap()
    const tasks: { pollUri: AtUriString; cid?: string; option: number }[] = []
    for (const { uri, cid } of pollRefs) {
      const poll = polls.get(uri)
      if (!poll) continue
      const agg = aggs.get(uri)
      const optionCount = poll.record.options.length
      for (let option = 0; option < optionCount; option++) {
        if ((agg?.optionCounts[option] ?? 0) > 0) {
          tasks.push({ pollUri: uri, cid, option })
        }
      }
    }
    if (!tasks.length) return map

    const results = await Promise.all(
      tasks.map((task) =>
        this.dataplane.getPollVoterFacepile({
          viewerDid: viewer ?? '',
          subject: { uri: task.pollUri, cid: task.cid ?? '' },
          option: task.option,
          limit: FACEPILE_SIZE,
        }),
      ),
    )

    for (let i = 0; i < tasks.length; i++) {
      const { pollUri, option } = tasks[i]
      map.set(pollFacepileKey(pollUri, option), results[i].dids as DidString[])
    }
    return map
  }
}

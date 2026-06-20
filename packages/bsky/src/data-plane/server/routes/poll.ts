import { ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { keyBy } from '@atproto/common'
import { Service } from '../../../proto/bsky_connect.js'
import { Database } from '../db/index.js'
import { TimeCidKeyset, paginate } from '../db/pagination.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getPollVotesBySubject(req) {
    const { subject, hasOption, option, cursor, limit } = req
    const { ref } = db.db.dynamic

    if (!subject?.uri) {
      return { uris: [] }
    }

    // @NOTE ignoring subject.cid
    let builder = db.db
      .selectFrom('poll_vote')
      .where('poll_vote.subject', '=', subject.uri)
      .selectAll('poll_vote')

    if (hasOption) {
      builder = builder.where('poll_vote.option', '=', option)
    }

    const keyset = new TimeCidKeyset(
      ref('poll_vote.sortAt'),
      ref('poll_vote.cid'),
    )
    builder = paginate(builder, { limit, cursor, keyset })

    const votes = await builder.execute()

    return {
      uris: votes.map((v) => v.uri),
      cursor: keyset.packFromResult(votes),
    }
  },

  async getPollVotesByActorAndSubjects(req) {
    const { actorDid, refs } = req
    if (refs.length === 0) {
      return { votes: [] }
    }
    // @NOTE ignoring ref.cid
    const res = await db.db
      .selectFrom('poll_vote')
      .where('creator', '=', actorDid)
      .where(
        'subject',
        'in',
        refs.map(({ uri }) => uri),
      )
      .selectAll()
      .execute()
    const bySubject = keyBy(res, 'subject')
    const votes = refs.map(({ uri }) => {
      const found = bySubject.get(uri)
      return {
        uri: found?.uri ?? '',
        option: found?.option ?? 0,
      }
    })
    return { votes }
  },

  async getPollVoteCounts(req) {
    const { refs } = req
    if (refs.length === 0) {
      return { counts: [] }
    }
    const pollUris = refs.map(({ uri }) => uri)
    const res = await db.db
      .selectFrom('poll_option_agg')
      .where('pollUri', 'in', pollUris)
      .selectAll()
      .orderBy('option', 'asc')
      .execute()

    const byPoll = new Map<string, { option: number; voteCount: number }[]>()
    for (const row of res) {
      const list = byPoll.get(row.pollUri) ?? []
      list.push({ option: row.option, voteCount: row.voteCount })
      byPoll.set(row.pollUri, list)
    }

    const counts = pollUris.map((uri) => {
      const rows = byPoll.get(uri) ?? []
      // dense array indexed by option position
      const maxOption = rows.reduce((m, r) => Math.max(m, r.option), -1)
      const optionCounts = new Array(maxOption + 1).fill(0)
      let total = 0
      for (const { option, voteCount } of rows) {
        optionCounts[option] = voteCount
        total += voteCount
      }
      return { optionCounts, total }
    })

    return { counts }
  },

  async getPollVoterFacepile(req) {
    const { viewerDid, subject, option, limit } = req
    if (!subject?.uri) {
      return { dids: [] }
    }

    if (!viewerDid) {
      const rows = await db.db
        .selectFrom('poll_vote')
        .where('poll_vote.subject', '=', subject.uri)
        .where('poll_vote.option', '=', option)
        .orderBy('poll_vote.sortAt', 'desc')
        .orderBy('poll_vote.cid', 'desc')
        .select('poll_vote.creator as did')
        .limit(limit || 3)
        .execute()
      return { dids: rows.map((r) => r.did) }
    }

    // Prioritize accounts the viewer follows, then fall back to most recent
    // voters. A follow match sorts ahead (0) of non-follows (1).
    const rows = await db.db
      .selectFrom('poll_vote')
      .leftJoin('follow', (join) =>
        join
          .onRef('follow.subjectDid', '=', 'poll_vote.creator')
          .on('follow.creator', '=', viewerDid),
      )
      .where('poll_vote.subject', '=', subject.uri)
      .where('poll_vote.option', '=', option)
      .select('poll_vote.creator as did')
      .select(
        sql<number>`(case when "follow"."uri" is null then 1 else 0 end)`.as(
          'followRank',
        ),
      )
      .orderBy('followRank', 'asc')
      .orderBy('poll_vote.sortAt', 'desc')
      .orderBy('poll_vote.cid', 'desc')
      .limit(limit || 3)
      .execute()

    return { dids: rows.map((r) => r.did) }
  },
})

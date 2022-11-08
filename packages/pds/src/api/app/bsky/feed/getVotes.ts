import { Server } from '../../../../lexicon'
import * as GetVotes from '../../../../lexicon/types/app/bsky/feed/getVotes'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server) {
  server.app.bsky.feed.getVotes(
    async (params: GetVotes.QueryParams, _input, _req, res) => {
      const { uri, limit, before, cid, direction } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      if (
        typeof direction === 'string' &&
        direction !== 'up' &&
        direction !== 'down'
      ) {
        throw new InvalidRequestError(
          `Parameter 'direction' takes values ('up', 'down')`,
        )
      }

      let builder = db.db
        .selectFrom('app_bsky_vote as vote')
        .where('vote.subject', '=', uri)
        .innerJoin('did_handle', 'vote.creator', 'did_handle.did')
        .leftJoin(
          'app_bsky_profile as profile',
          'profile.creator',
          'did_handle.did',
        )
        .select([
          'vote.direction as direction',
          'vote.createdAt as createdAt',
          'vote.indexedAt as indexedAt',
          'did_handle.did as did',
          'did_handle.handle as handle',
          'profile.displayName as displayName',
        ])

      if (direction) {
        builder = builder.where('vote.direction', '=', direction)
      }

      if (cid) {
        builder = builder.where('vote.subjectCid', '=', cid)
      }

      builder = paginate(builder, {
        limit,
        before,
        by: ref('vote.createdAt'),
      })

      const votesRes = await builder.execute()

      const votes = votesRes.map((row) => ({
        direction: row.direction,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
        actor: {
          did: row.did,
          handle: row.handle,
          displayName: row.displayName || undefined,
        },
      }))

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          cursor: votes.at(-1)?.createdAt,
          votes,
        },
      }
    },
  )
}

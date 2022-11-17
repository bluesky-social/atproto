import { AtUri } from '@atproto/uri'
import * as schema from '../../../../lexicon/schemas'
import { Server } from '../../../../lexicon'
import * as locals from '../../../../locals'
import * as repoUtil from '../../../../util/repo'
import { TID } from '@atproto/common'
import { DeleteOp } from '@atproto/repo'

export default function (server: Server) {
  server.app.bsky.feed.setVote(async (_params, input, req, res) => {
    const { subject, direction } = input.body
    const { auth, db } = locals.get(res)

    const requester = auth.getUserDidOrThrow(req)
    const authStore = await locals.getAuthstore(res, requester)
    const now = new Date().toISOString()

    const voteUri = await db.transaction(async (dbTxn) => {
      const existingVotes = await dbTxn.db
        .selectFrom('vote')
        .select(['uri', 'direction'])
        .where('creator', '=', requester)
        .where('subject', '=', subject.uri)
        .execute()

      if (direction === 'none' && existingVotes.length === 0) {
        // Already in desired state
        return
      }

      if (
        existingVotes.length === 1 &&
        existingVotes[0].direction === direction
      ) {
        // Already in desired state
        return existingVotes[0].uri
      }

      const writes = await repoUtil.prepareWrites(requester, [
        ...existingVotes.map((vote): DeleteOp => {
          const uri = new AtUri(vote.uri)
          return {
            action: 'delete',
            collection: uri.collection,
            rkey: uri.rkey,
          }
        }),
      ])

      let create: repoUtil.PreparedCreate | undefined

      if (direction !== 'none') {
        create = await repoUtil.prepareCreate(requester, {
          action: 'create',
          collection: schema.ids.AppBskyFeedVote,
          rkey: TID.nextStr(),
          value: {
            direction,
            subject,
            createdAt: now,
          },
        })
        writes.push(create)
      }

      await repoUtil.writeToRepo(dbTxn, requester, authStore, writes, now)
      await repoUtil.indexWrites(dbTxn, writes, now)

      return create?.uri.toString()
    })

    return {
      encoding: 'application/json',
      body: {
        upvote: (direction === 'up' && voteUri) || undefined,
        downvote: (direction === 'down' && voteUri) || undefined,
      },
    }
  })
}

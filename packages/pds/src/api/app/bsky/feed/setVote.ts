import { AtUri } from '@atproto/uri'
import * as lexicons from '../../../../lexicon/lexicons'
import { Server } from '../../../../lexicon'
import * as locals from '../../../../locals'
import * as repo from '../../../../repo'
import { TID } from '@atproto/common'
import { DeleteOp } from '@atproto/repo'
import ServerAuth from '../../../../auth'

export default function (server: Server) {
  server.app.bsky.feed.setVote({
    auth: ServerAuth.verifier,
    handler: async ({ auth, input, res }) => {
      const { subject, direction } = input.body
      const { db } = locals.get(res)

      const requester = auth.credentials.did
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

        const writes = await repo.prepareWrites(requester, [
          ...existingVotes.map((vote): DeleteOp => {
            const uri = new AtUri(vote.uri)
            return {
              action: 'delete',
              collection: uri.collection,
              rkey: uri.rkey,
            }
          }),
        ])

        let create: repo.PreparedCreate | undefined

        if (direction !== 'none') {
          create = await repo.prepareCreate(requester, {
            action: 'create',
            collection: lexicons.ids.AppBskyFeedVote,
            rkey: TID.nextStr(),
            value: {
              direction,
              subject,
              createdAt: now,
            },
          })
          writes.push(create)
        }

        await Promise.all([
          await repo.writeToRepo(dbTxn, requester, authStore, writes, now),
          await repo.indexWrites(dbTxn, writes, now),
        ])

        return create?.uri.toString()
      })

      return {
        encoding: 'application/json',
        body: {
          upvote: (direction === 'up' && voteUri) || undefined,
          downvote: (direction === 'down' && voteUri) || undefined,
        },
      }
    },
  })
}

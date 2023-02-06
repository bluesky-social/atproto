import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as lexicons from '../../../../lexicon/lexicons'
import { Server } from '../../../../lexicon'
import * as repo from '../../../../repo'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.setVote({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const { subject, direction } = input.body

      const requester = auth.credentials.did
      const now = new Date().toISOString()

      const exists = await ctx.services
        .record(ctx.db)
        .hasRecord(new AtUri(subject.uri), subject.cid)
      if (!exists) throw new InvalidRequestError('Subject not found')

      const voteUri = await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
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

        const writes: repo.PreparedWrite[] = await Promise.all(
          existingVotes.map((vote) => {
            const uri = new AtUri(vote.uri)
            return repo.prepareDelete({
              did: requester,
              collection: uri.collection,
              rkey: uri.rkey,
            })
          }),
        )

        let create: repo.PreparedCreate | undefined

        if (direction !== 'none') {
          create = await repo.prepareCreate({
            did: requester,
            collection: lexicons.ids.AppBskyFeedVote,
            record: {
              direction,
              subject,
              createdAt: now,
            },
          })
          writes.push(create)
        }

        await repoTxn.processCreatesAndDeletes(requester, writes, now)

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

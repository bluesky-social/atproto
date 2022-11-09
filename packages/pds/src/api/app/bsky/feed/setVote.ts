import { RepoStructure } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as schema from '../../../../lexicon/schemas'
import { Server } from '../../../../lexicon'
import * as locals from '../../../../locals'
import * as repoUtil from '../../../../util/repo'
import { TID } from '@atproto/common'

export default function (server: Server) {
  server.app.bsky.feed.setVote(async (_params, input, req, res) => {
    const { subject, direction } = input.body
    const { auth, db, logger } = locals.get(res)

    const requester = auth.getUserDidOrThrow(req)
    const authStore = await locals.getAuthstore(res, requester)

    const voteUri = await db.transaction(async (dbTxn) => {
      const currRoot = await dbTxn.getRepoRoot(requester, true)
      if (!currRoot) {
        throw new InvalidRequestError(
          `${requester} is not a registered repo on this server`,
        )
      }

      const now = new Date().toISOString()
      const ctx = repoUtil.mutationContext(dbTxn, requester, now)
      const repo = await RepoStructure.load(ctx.blockstore, currRoot)

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

      const deleteExistingVotes = existingVotes.map(({ uri }) =>
        repoUtil.prepareDelete(ctx, new AtUri(uri)),
      )

      const createNewVote =
        direction === 'none'
          ? null
          : await repoUtil.prepareCreate(
              ctx,
              schema.ids.AppBskyFeedVote,
              TID.nextStr(),
              {
                direction,
                subject,
                createdAt: now,
              },
            )

      const changes = createNewVote
        ? [...deleteExistingVotes, createNewVote]
        : deleteExistingVotes

      const commit = repo
        .stageUpdate(changes.map((change) => change.toStage))
        .createCommit(authStore, async (prev, curr) => {
          const success = await dbTxn.updateRepoRoot(requester, curr, prev, now)
          if (!success) {
            logger.error({ did: ctx.did, curr, prev }, 'repo update failed')
            throw new Error('Could not update repo root')
          }
          return null
        })

      await Promise.all([commit, ...changes.map((change) => change.dbUpdate)])

      return createNewVote?.uri.toString()
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

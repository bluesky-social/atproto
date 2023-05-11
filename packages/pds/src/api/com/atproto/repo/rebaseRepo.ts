import { CID } from 'multiformats/cid'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { BadCommitSwapError } from '../../../../repo'
import AppContext from '../../../../context'
import { ConcurrentWriteError } from '../../../../services/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.rebaseRepo({
    auth: ctx.accessVerifierNotAppPassword,
    handler: async ({ input, auth }) => {
      const { repo, swapCommit } = input.body
      const did = await ctx.services.account(ctx.db).getDidForActor(repo)

      if (!did) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      } else if (did !== auth.credentials.did) {
        throw new AuthRequiredError()
      }

      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined

      try {
        await ctx.services.repo(ctx.db).rebaseRepo(repo, swapCommitCid)
      } catch (err) {
        if (err instanceof BadCommitSwapError) {
          throw new InvalidRequestError(err.message, 'InvalidSwap')
        } else if (err instanceof ConcurrentWriteError) {
          throw new InvalidRequestError(err.message, 'ConcurrentWrites')
        }
        throw err
      }
    },
  })
}

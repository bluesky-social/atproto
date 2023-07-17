import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { CID } from 'multiformats/cid'
import { BadCommitSwapError } from '../../../../repo'
import { ConcurrentWriteError } from '../../../../services/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.rebaseRepo({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { repo, swapCommit } = input.body
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

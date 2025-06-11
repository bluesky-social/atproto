import { MINUTE } from '@atproto/common'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AccountStatus } from '../../../../account-manager/account-manager'
import { OLD_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 50,
    },
    handler: async ({ input, req }) => {
      const { did, password, token } = input.body

      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.deleteAccount(
          input.body,
          ctx.entrywayPassthruHeaders(req),
        )
        return
      }

      if (password.length > OLD_PASSWORD_MAX_LENGTH) {
        throw new InvalidRequestError('Invalid password length.')
      }

      const validPass = await ctx.accountManager.verifyAccountPassword(
        did,
        password,
      )
      if (!validPass) {
        throw new AuthRequiredError('Invalid did or password')
      }

      await ctx.accountManager.assertValidEmailToken(
        did,
        'delete_account',
        token,
      )
      await ctx.actorStore.destroy(did)
      await ctx.accountManager.deleteAccount(did)
      const accountSeq = await ctx.sequencer.sequenceAccountEvt(
        did,
        AccountStatus.Deleted,
      )
      await ctx.sequencer.deleteAllForUser(did, [accountSeq])
    },
  })
}

import { MINUTE } from '@atproto/common'
import {
  AuthRequiredError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { OLD_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  server.add(com.atproto.server.deleteAccount, {
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 50,
    },
    handler: async ({ input: { body }, req }) => {
      const { did, password, token } = body

      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      if (entrywayClient) {
        const { headers } = ctx.entrywayPassthruHeaders(req)
        await entrywayClient.xrpc(com.atproto.server.deleteAccount, {
          body,
          headers,
        })
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

      // @NOTE Order matters here and is the reverse order of account creation.
      // Putting the sequencer first allows for proper restoration of the
      // account's state in case of outage recovery. We then "unlink" the
      // account and finally remove the files from the file system.
      await ctx.sequencer.deleteAccount(did)
      await ctx.accountManager.deleteAccount(did)
      await ctx.actorStore.destroy(did)
    },
  })
}

import { MINUTE } from '@atproto/common'
import {
  AuthRequiredError,
  InvalidRequestError,
  MethodRateLimit,
  Server,
} from '@atproto/xrpc-server'
import { OLD_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const rateLimit: MethodRateLimit = {
    durationMs: 5 * MINUTE,
    points: 50,
  }

  if (entrywayClient) {
    server.add(com.atproto.server.deleteAccount, {
      rateLimit,
      handler: async ({ input: { body }, req }) => {
        const account = await ctx.accountManager.getAccount(body.did, {
          includeDeactivated: true,
          includeTakenDown: true,
        })
        if (!account) {
          throw new InvalidRequestError('account not found')
        }

        const { headers } = ctx.entrywayPassthruHeaders(req)
        await entrywayClient.xrpc(com.atproto.server.deleteAccount, {
          body,
          headers,
        })
      },
    })
  } else {
    server.add(com.atproto.server.deleteAccount, {
      rateLimit,
      handler: async ({ input: { body } }) => {
        const { did, password, token } = body

        if (password.length > OLD_PASSWORD_MAX_LENGTH) {
          throw new AuthRequiredError(
            'Password too long. Consider resetting your password.',
          )
        }

        const account = await ctx.accountManager.getAccount(did, {
          includeDeactivated: true,
          includeTakenDown: true,
        })
        if (!account) {
          throw new InvalidRequestError('account not found')
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

        // @NOTE Order matters here: first "unlink" the account by removing it
        // from the account manager database ("source of truth"), then notify the
        // sequencer, and finally cleanup files from the file system.
        await ctx.accountManager.deleteAccount(did)
        try {
          await ctx.sequencer.sequenceAccountDeletion(did)
        } finally {
          await ctx.actorStore.destroy(did)
        }
      },
    })
  }
}

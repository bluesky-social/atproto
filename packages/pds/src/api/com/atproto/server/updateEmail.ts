import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { UserAlreadyExistsError } from '../../../../account-manager/helpers/account.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { requestEmailUpdateAuth } from './requestEmailUpdate.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  // @NOTE Ensure that both endpoints use the same authentication logic
  const auth = requestEmailUpdateAuth(ctx)

  if (entrywayClient) {
    server.add(com.atproto.server.updateEmail, {
      auth,
      handler: async ({ auth, input: { body }, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.updateEmail.$lxm,
        )

        await entrywayClient.xrpc(com.atproto.server.updateEmail, {
          headers,
          body,
        })
      },
    })
  } else {
    server.add(com.atproto.server.updateEmail, {
      auth,
      handler: async ({ auth, input: { body } }) => {
        const did = auth.credentials.did
        const { token, email } = body

        // @TODO get the locale somehow (either by adding a field in the request
        // body, or by using the `Accept-Language` header).
        const locale = undefined

        try {
          await ctx.accountManager.updateEmail(did, email, token, { locale })
        } catch (cause) {
          if (cause instanceof UserAlreadyExistsError) {
            throw new InvalidRequestError(cause.message, undefined, { cause })
          }

          throw cause
        }
      },
    })
  }
}

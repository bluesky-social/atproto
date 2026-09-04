import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { UserAlreadyExistsError } from '../../../../account-manager/helpers/account.js'
import type { AppContext } from '../../../../context.js'
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
        const user = await ctx.accountManager.getAccount(did, {
          includeDeactivated: true,
          includeTakenDown: true,
        })
        if (!user) {
          throw new InvalidRequestError(
            `Could not find user info for account: ${did}`,
          )
        }

        const { token, email, emailAuthFactor } = body
        // @TODO get the locale somehow (either by adding a field in the request
        // body, or by using the `Accept-Language` header).
        const locale = undefined

        // Pure auth-factor toggle: the email isn't changing, the caller is only
        // flipping the OTP factor on/off. Handle it and return; falling
        // through to updateEmail() would re-set the (unchanged) email and null
        // out emailConfirmedAt, silently un-confirming a confirmed address.
        // Emails are normalized to lowercase:
        if (
          user.email === email.toLowerCase() &&
          user.emailConfirmedAt &&
          emailAuthFactor !== undefined
        ) {
          if (emailAuthFactor) {
            // Enabling only adds protection: immediate, no token required.
            await ctx.accountManager.enableEmailAuthFactor({
              did,
              email: user.email,
            })
          } else {
            // Disabling removes a second factor, so it's gated by an
            // `update_email` OTP: the first call (no token) emails a code and
            // makes no change; the second (with token) verifies and disables.
            const account = await ctx.accountManager.disableEmailAuthFactor({
              did,
              email: user.email,
              token,
              locale,
            })

            if (account === null) {
              throw new InvalidRequestError(
                'confirmation token required',
                'TokenRequired',
              )
            }
          }

          return
        }

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

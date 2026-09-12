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

        const { token, emailAuthFactor } = body
        const email = body.email.toLowerCase()
        // @TODO get the locale somehow (either by adding a field in the request
        // body, or by using the `Accept-Language` header).
        const locale = undefined

        const hasEmailAuthFactor = user.emailConfirmedAt != null

        if (emailAuthFactor != null && emailAuthFactor !== hasEmailAuthFactor) {
          if (emailAuthFactor) {
            // User is trying to enable email OTP
            if (user.emailConfirmedAt && user.email === email) {
              // Enabling only adds protection: immediate, no token required.
              await ctx.accountManager.enableEmailAuthFactor({
                did,
                email: user.email,
              })

              return // no need to continue to email change since email is not being changed
            } else {
              // @NOTE updating the user email address has the effect of resetting the
              // email OTP status, reverting any action we would be performing here.
              // Instead of silently ignoring a request to enable email OTP while updating
              // the email, we provide an error message.
              throw new InvalidRequestError(
                'Please change and verify your email before enabling OTP',
              )
            }
          } else {
            // User is trying to disable email OTP
            if (user.email === email) {
              // Disabling removes a second factor, so it's gated by an
              // `update_email` OTP: the first call (no token) emails a code and
              // makes no change; the second (with token) verifies and disables.
              const result = await ctx.accountManager.disableEmailAuthFactor({
                did,
                email: user.email,
                token,
                locale,
              })

              if (result?.tokenRequired) {
                throw new InvalidRequestError(
                  'confirmation token required',
                  'TokenRequired',
                )
              }

              return // no need to continue to email change since email is not being changed
            } else {
              // No-op: changing email address always disables OTP
            }
          }
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

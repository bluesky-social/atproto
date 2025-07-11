import crypto from 'node:crypto'
import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import {
  InvalidRequestError,
  MethodNotImplementedError,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { KwsExternalPayload } from '../../../kws/types'
import { createStashEvent, getClientUa } from '../../../kws/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.initAgeAssurance({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input, req }) => {
      if (!ctx.kwsClient) {
        throw new MethodNotImplementedError(
          'This service is not configured to support age assurance.',
        )
      }
      const { email, language, countryCode } = input.body
      if (!isEmailValid(email) || isDisposableEmail(email)) {
        throw new InvalidRequestError(
          'This email address is not supported, please use a different email.',
        )
      }

      const actorDid = auth.credentials.iss
      const attemptId = crypto.randomUUID()
      // Assumes `app.set('trust proxy', ...)` configured with `true` or specific values.
      const initIp = req.ip
      const initUa = getClientUa(req)
      const externalPayload: KwsExternalPayload = { actorDid, attemptId }

      await ctx.kwsClient.sendEmail({
        countryCode,
        email,
        externalPayload,
        language,
      })

      const event = await createStashEvent(ctx, {
        actorDid,
        attemptId,
        email,
        initIp,
        initUa,
        status: 'pending',
      })

      return {
        encoding: 'application/json',
        body: {
          status: event.status,
          lastInitiatedAt: event.createdAt,
        },
      }
    },
  })
}

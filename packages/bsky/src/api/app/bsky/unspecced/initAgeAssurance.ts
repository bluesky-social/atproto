import crypto from 'node:crypto'
import { isEmailValid } from '@hapi/address'
import {
  InvalidRequestError,
  MethodNotImplementedError,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceExternalPayload } from '../../../kws/types'
import { createStashEvent, getClientIp, getClientUa } from '../../../kws/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.initAgeAssurance({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input, req }) => {
      if (!ctx.ageAssuranceClient) {
        throw new MethodNotImplementedError(
          'This service is not configured to support age assurance.',
        )
      }
      const { email, language } = input.body
      if (!isEmailValid(email)) {
        throw new InvalidRequestError(
          'This email address is not supported, please use a different email.',
        )
      }

      const actorDid = auth.credentials.iss
      const attemptId = crypto.randomUUID()
      const initIp = getClientIp(req)
      const initUa = getClientUa(req)
      const externalPayload: AgeAssuranceExternalPayload = {
        actorDid,
        attemptId,
        email,
        initIp,
        initUa,
      }

      await ctx.ageAssuranceClient.sendEmail({
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

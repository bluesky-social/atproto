import crypto from 'node:crypto'
import express from 'express'
import { MethodNotImplementedError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceExternalPayload } from '../../../kws/types'
import { createStashEvent } from '../../../kws/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.initAgeAssurance({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input, req }) => {
      if (!ctx.ageAssuranceClient) {
        throw new MethodNotImplementedError(
          'This service is not configured to support age assurance.',
        )
      }

      const actorDid = auth.credentials.iss
      const attemptId = crypto.randomUUID()
      const attemptIp = getClientIp(req)
      const externalPayload: AgeAssuranceExternalPayload = {
        actorDid,
        attemptId,
        attemptIp,
      }

      await ctx.ageAssuranceClient.sendEmail({
        email: input.body.email,
        externalPayload,
        language: input.body.language,
      })

      const event = await createStashEvent(ctx, {
        actorDid,
        attemptId,
        attemptIp,
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

const getClientIp = (req: express.Request): string | undefined => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim()
  }
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.trim()
  }
  return undefined
}

import crypto from 'node:crypto'
import express from 'express'
import { TID } from '@atproto/common'
import { MethodNotImplementedError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceEvent } from '../../../../lexicon/types/app/bsky/unspecced/defs'
import { Namespaces } from '../../../../stash'

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
      await ctx.ageAssuranceClient.sendEmail({
        email: input.body.email,
        externalPayload: {
          actorDid,
          attemptId,
          attemptIp,
        },
        language: input.body.language,
      })

      const status = 'pending'
      const now = new Date().toISOString()
      const payload: AgeAssuranceEvent = {
        attemptId,
        attemptIp,
        status,
        timestamp: now,
      }
      await ctx.stashClient.create({
        actorDid,
        namespace: Namespaces.AppBskyUnspeccedDefsAgeAssuranceEvent,
        key: TID.nextStr(),
        payload,
      })

      return {
        encoding: 'application/json',
        body: {
          status,
          lastInitiatedAt: now,
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

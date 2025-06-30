import crypto from 'node:crypto'
import { TID } from '@atproto/common'
import { MethodNotImplementedError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceEvent } from '../../../../lexicon/types/app/bsky/unspecced/defs'
import { Namespaces } from '../../../../stash'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.initAgeAssurance({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      if (!ctx.ageAssuranceClient) {
        throw new MethodNotImplementedError(
          'This service is not configured to support age assurance.',
        )
      }

      const actorDid = auth.credentials.iss
      const attemptId = crypto.randomUUID()
      // @TODO: Get the IP address from the request context.
      const attemptIp = 'TODO'

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

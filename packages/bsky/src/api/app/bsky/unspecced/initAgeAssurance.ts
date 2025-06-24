import crypto from 'node:crypto'

import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceStatePayload } from '../../../../lexicon/types/app/bsky/unspecced/defs'

import { KWS_CLIENT_ID, KWS_API_KEY } from './env'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.initAgeAssurance({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const actorDid = auth.credentials.iss

      let success = true
      try {
        const auth = await fetch(
          `https://auth.kidswebservices.com/auth/realms/kws/protocol/openid-connect/token`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${KWS_CLIENT_ID}:${KWS_API_KEY}`).toString('base64')}`,
            },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              scope: 'verification',
            }),
          },
        )

        const { access_token } = (await auth.json()) as {
          access_token: string
          expires_in: number
        }

        if (access_token) {
          const attemptId = crypto.randomUUID()

          await fetch(
            `https://api.kidswebservices.com/v1/verifications/send-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'bluesky-pbc-test-agent',
                Authorization: `Bearer ${access_token}`,
              },
              body: JSON.stringify({
                email: input.body.email,
                location: 'US',
                // TODO abstract this
                externalPayload: JSON.stringify({ actorDid, attemptId }),
                userContext: 'adult',
                language: 'en',
              }),
            },
          )

          const NSID = 'app.bsky.unspecced.defs#ageAssuranceState'
          const payload: AgeAssuranceStatePayload = {
            timestamp: new Date().toISOString(),
            source: 'user',
            status: 'pending',
            attemptId,
          }

          // TODO store this
          console.log('stash', {
            NSID,
            payload,
          })
        }
      } catch (e) {
        console.error(e)
        success = false
      }

      return {
        encoding: 'application/json',
        body: {
          success,
        },
      }
    },
  })
}

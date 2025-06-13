import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

import { OAUTH_URL, SEND_EMAIL_URL, CLIENT_ID, API_KEY } from './env'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.verification.initiateAgeVerification({
    auth: ctx.authVerifier.standard,
    handler: async ({ input }) => {
      let success = true

      try {
        const auth = await fetch(OAUTH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${API_KEY}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'verification',
          }),
        })

        const { access_token } = (await auth.json()) as {
          access_token: string
          expires_in: number
        }

        if (access_token) {
          await fetch(SEND_EMAIL_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'bluesky-pbc-test-agent',
              Authorization: `Bearer ${access_token}`,
            },
            body: JSON.stringify({
              email: input.body.email,
              location: 'US',
              externalPayload: '{}',
              userContext: 'adult',
              language: 'en',
            }),
          })
        }
      } catch {
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

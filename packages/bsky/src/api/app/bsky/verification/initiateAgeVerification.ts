import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

const oauthEndpoint = ``
const apiEndpoint = ``
const clientID = ``
const apiKey = ``

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.verification.initiateAgeVerification({
    auth: ctx.authVerifier.standard,
    handler: async ({ input }) => {
      const { access_token } = (await fetch(oauthEndpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientID}:${apiKey}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'verification',
        }),
      }).then((r) => r.json())) as { access_token: string; expires_in: number }

      if (access_token) {
        ;(await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'bluesky-pbc-test',
            Authorization: `Bearer ${access_token}`,
          },
          body: JSON.stringify({
            email: input.body.email,
            location: 'US',
            externalPayload: '{"some":{"values":true},"id":"123xyz"}',
            userContext: 'adult',
            language: 'en',
          }),
        }).then((r) => r.json())) as { signedVerificationUrl: string }
      }

      return {
        encoding: 'application/json',
        body: {
          success: true,
        },
      }
    },
  })
}

import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.verification.handleAgeVerificationComplete({
    handler: async ({ params }) => {
      // const { status, externalPayload, signature } = params
      // const rawPayload = `${status}:${externalPayload}`

      console.log('handleAgeVerificationComplete', params)

      return {
        encoding: 'application/json',
        statusCode: 302,
        headers: {
          Location: `https://bsky.app`,
        },
        body: {
          status: 'success',
        },
      }
    },
  })
}

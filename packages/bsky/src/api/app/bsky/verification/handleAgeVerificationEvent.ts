import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, _ctx: AppContext) {
  server.app.bsky.verification.handleAgeVerificationEvent({
    handler: async ({ params }) => {
      // const rawPayload = `${status}:${externalPayload}`

      console.log('handleAgeVerificationEvent', params)

      return {
        encoding: 'application/json',
        body: {
          ack: 'ack',
        },
      }
    },
  })
}

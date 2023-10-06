import { streamToBytes } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, proxy, resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.uploadBlob({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input, req }) => {
      const proxied = await proxy(ctx, auth.credentials, async (agent) => {
        const result = await agent.api.com.atproto.repo.uploadBlob(
          await streamToBytes(input.body), // @TODO proxy streaming
          authPassthru(req, true),
        )
        return resultPassthru(result)
      })
      if (proxied !== null) {
        return proxied
      }

      const requester = auth.credentials.did
      const blob = await ctx.services
        .repo(ctx.db)
        .blobs.addUntetheredBlob(requester, input.encoding, input.body)

      return {
        encoding: 'application/json',
        body: {
          blob,
        },
      }
    },
  })
}

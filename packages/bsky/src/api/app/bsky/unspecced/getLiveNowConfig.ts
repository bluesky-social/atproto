import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  const { liveNowConfig } = ctx.cfg
  if (!liveNowConfig) {
    return
  }

  server.app.bsky.unspecced.getLiveNowConfig({
    handler: async () => {
      return {
        encoding: 'application/json',
        body: {
          config: liveNowConfig,
        },
      }
    },
  })
}

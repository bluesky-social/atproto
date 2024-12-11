import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.purchase.getSubscriptionGroup({
    handler: async ({ params }) => {
      const { group, platform } = params

      const { offerings } = await ctx.bsyncClient.getSubscriptionGroup({
        group,
        platform,
      })

      return {
        encoding: 'application/json',
        body: {
          group,
          offerings: offerings.map(({ id, product }) => ({
            id,
            platform,
            product,
          })),
        },
      }
    },
  })
}

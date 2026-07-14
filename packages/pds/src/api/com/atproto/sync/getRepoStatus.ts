import type { Server } from '@atproto/xrpc-server'
import { formatAccountStatus } from '../../../../account-manager/account-manager.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.sync.getRepoStatus, {
    handler: async ({ params }) => {
      const { did } = params
      const account = await assertRepoAvailability(ctx, did, true)

      const { active, status } = formatAccountStatus(account)

      let rev: string | undefined = undefined
      if (active) {
        const root = await ctx.actorStore.read(did, (store) =>
          store.repo.storage.getRootDetailed(),
        )
        rev = root.rev
      }

      return {
        encoding: 'application/json' as const,
        body: {
          did,
          active,
          status,
          rev,
        },
      }
    },
  })
}

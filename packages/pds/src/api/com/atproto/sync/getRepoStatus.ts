import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { assertRepoAvailability } from './util'
import { AccountStatus } from '../../../../account-manager'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRepoStatus({
    handler: async ({ params }) => {
      const { did } = params
      const account = await assertRepoAvailability(ctx, did, true)
      const active = !account.takedownRef && !account.deactivatedAt

      let status: string | undefined = undefined
      if (!active) {
        if (account.takedownRef) {
          status = AccountStatus.Takendown
        } else if (account.deactivatedAt) {
          status = AccountStatus.Deactivated
        }
      }

      let rev: string | undefined = undefined
      if (active) {
        const root = await ctx.actorStore.read(did, (store) =>
          store.repo.storage.getRootDetailed(),
        )
        rev = root.rev
      }

      return {
        encoding: 'application/json',
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

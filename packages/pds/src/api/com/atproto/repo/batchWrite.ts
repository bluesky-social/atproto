import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import * as repo from '../../../../repo'
import { Server } from '../../../../lexicon'
import { InvalidRecordError, PreparedWrite } from '../../../../repo'
import AppContext from '../../../../context'
import { WriteOpAction } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.batchWrite({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const tx = input.body
      const { did, validate } = tx
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      const hasUpdate = tx.writes.some(
        (write) => write.action === WriteOpAction.Update,
      )
      if (hasUpdate) {
        throw new InvalidRequestError(`Updates are not yet supported.`)
      }

      let writes: PreparedWrite[]
      try {
        writes = await Promise.all(
          tx.writes.map((write) => {
            if (write.action === WriteOpAction.Create) {
              return repo.prepareCreate({
                did,
                collection: write.collection,
                record: write.value,
                rkey: write.rkey,
                validate,
              })
            } else if (write.action === WriteOpAction.Delete) {
              return repo.prepareDelete({
                did,
                collection: write.collection,
                rkey: write.rkey,
              })
            } else {
              throw new InvalidRequestError(
                `Action not supported: ${write.action}`,
              )
            }
          }),
        )
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      await ctx.db.transaction(async (dbTxn) => {
        const now = new Date().toISOString()
        const repoTxn = ctx.services.repo(dbTxn)
        await repoTxn.processWrites(did, writes, now)
      })
    },
  })
}

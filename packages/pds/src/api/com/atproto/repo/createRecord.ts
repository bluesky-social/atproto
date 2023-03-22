import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import * as repo from '../../../../repo'
import { Server } from '../../../../lexicon'
import { InvalidRecordError, PreparedCreate } from '../../../../repo'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.createRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { did, collection, record } = input.body
      const validate =
        typeof input.body.validate === 'boolean' ? input.body.validate : true
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      // determine key type. if undefined, repo assigns a TID
      const rkey = repo.determineRkey(collection)

      const now = new Date().toISOString()
      let write: PreparedCreate
      try {
        write = await repo.prepareCreate({
          did,
          collection,
          record,
          rkey,
          validate,
        })
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
        await repoTxn.processWrites(did, [write], now)
      })

      return {
        encoding: 'application/json',
        body: { uri: write.uri.toString(), cid: write.cid.toString() },
      }
    },
  })
}

import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { prepareUpdate, prepareCreate } from '../../../../repo'
import AppContext from '../../../../context'
import {
  BadCommitSwapError,
  BadRecordSwapError,
  InvalidRecordError,
  PreparedCreate,
  PreparedUpdate,
} from '../../../../repo'
import { ConcurrentWriteError } from '../../../../services/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.putRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const {
        repo,
        collection,
        rkey,
        record,
        validate,
        swapCommit,
        swapRecord,
      } = input.body
      const did = await ctx.services.account(ctx.db).getDidForActor(repo)

      if (!did) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      }
      if (did !== auth.credentials.did) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      const uri = AtUri.make(did, collection, rkey)
      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined
      const swapRecordCid =
        typeof swapRecord === 'string' ? CID.parse(swapRecord) : swapRecord

      const current = await ctx.services
        .record(ctx.db)
        .getRecord(uri, null, true)
      const writeInfo = {
        did,
        collection,
        rkey,
        record,
        swapCid: swapRecordCid,
        validate,
      }

      let write: PreparedCreate | PreparedUpdate
      try {
        write = current
          ? await prepareUpdate(writeInfo)
          : await prepareCreate(writeInfo)
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      const writes = [write]

      try {
        await ctx.services
          .repo(ctx.db)
          .processWrites({ did, writes, swapCommitCid }, 10)
      } catch (err) {
        if (
          err instanceof BadCommitSwapError ||
          err instanceof BadRecordSwapError
        ) {
          throw new InvalidRequestError(err.message, 'InvalidSwap')
        } else if (err instanceof ConcurrentWriteError) {
          throw new InvalidRequestError(err.message, 'ConcurrentWrites')
        } else {
          throw err
        }
      }

      return {
        encoding: 'application/json',
        body: {
          uri: write.uri.toString(),
          cid: write.cid.toString(),
        },
      }
    },
  })
}

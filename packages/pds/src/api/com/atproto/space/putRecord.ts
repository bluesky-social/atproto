import { WriteOpAction } from '@atproto/repo'
import {
  ForbiddenError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { prepareCreate, spaceRecordUri } from '../../../../repo/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.putRecord, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    rateLimit: [
      {
        name: 'repo-write-hour',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 2,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 2,
      },
    ],
    opts: {
      jsonLimit: 1_000_000,
    },
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey, record } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }

      const uri = spaceRecordUri(space, did, collection, rkey).toString()
      let exists = await ctx.actorStore.read(did, (actor) =>
        actor.space.hasRecord(uri),
      )
      assertSpaceScope(auth, space, {
        action: exists ? 'update' : 'create',
        collection,
      })

      // @NOTE Validation can perform DNS, DID, and repo fetches. Fully prepare
      // the write before opening the actor transaction, then change only its
      // action if the record changes while it is being prepared.
      const preparedCreate = await prepareCreate({
        did,
        space,
        collection,
        rkey,
        record,
        validate: input.body.validate,
        recordSchemaResolver: ctx.recordSchemaResolver,
      })

      const { commit, write } = await performPut()

      await fireNotifyWrite(ctx, { space, writerDid: did, commit })

      return {
        encoding: 'application/json' as const,
        body: {
          uri: write.uri.toString(),
          cid: write.cid.toString(),
          validationStatus: write.validationStatus,
        },
      }

      async function applyPut(expectedExists: boolean) {
        return ctx.actorStore.transact(did, async (actorTxn) => {
          if ((await actorTxn.space.hasRecord(uri)) !== expectedExists) {
            throw new PutStateChangedError()
          }

          const write = expectedExists
            ? { ...preparedCreate, action: WriteOpAction.Update }
            : preparedCreate
          const commit = await actorTxn.space.applyWrites(space, [write])
          return { commit, write }
        })
      }

      async function performPut() {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            return await applyPut(exists)
          } catch (err) {
            if (!(err instanceof PutStateChangedError)) throw err
            if (attempt > 0) {
              throw new InvalidRequestError(
                'Record changed while preparing write',
              )
            }
            exists = await ctx.actorStore.read(did, (actor) =>
              actor.space.hasRecord(uri),
            )
            assertSpaceScope(auth, space, {
              action: exists ? 'update' : 'create',
              collection,
            })
          }
        }
        throw new InvalidRequestError('Record changed while preparing write')
      }
    },
  })
}

class PutStateChangedError extends Error {
  name = 'PutStateChangedError'
}

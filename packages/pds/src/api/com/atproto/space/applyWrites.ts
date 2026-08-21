import { WriteOpAction } from '@atproto/repo'
import {
  ForbiddenError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  type PreparedWrite,
  prepareCreate,
  prepareDelete,
  prepareUpdate,
} from '../../../../repo/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

// Matches com.atproto.repo.applyWrites.
const MAX_WRITES = 200

const ratelimitPoints = ({
  input,
}: {
  input: com.atproto.space.applyWrites.$Input
}) => {
  let points = 0
  for (const op of input.body.writes) {
    if (com.atproto.space.applyWrites.create.$isTypeOf(op)) {
      points += 3
    } else if (com.atproto.space.applyWrites.update.$isTypeOf(op)) {
      points += 2
    } else {
      points += 1
    }
  }
  return points
}

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.applyWrites, {
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
        calcPoints: ratelimitPoints,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: ratelimitPoints,
      },
    ],
    opts: {
      jsonLimit: 1_000_000,
    },
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, writes, validate } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }
      if (writes.length > MAX_WRITES) {
        throw new InvalidRequestError(`Too many writes. Max: ${MAX_WRITES}`)
      }

      // @NOTE Authorize the raw operations before validation can resolve a published
      // schema over the network. Prepared actions preserve these exact values.
      for (const write of writes) {
        let action: 'create' | 'update' | 'delete'
        if (com.atproto.space.applyWrites.create.isTypeOf(write)) {
          action = 'create'
        } else if (com.atproto.space.applyWrites.update.isTypeOf(write)) {
          action = 'update'
        } else if (com.atproto.space.applyWrites.delete.isTypeOf(write)) {
          action = 'delete'
        } else {
          throw new InvalidRequestError(
            `Action not supported: ${write['$type']}`,
          )
        }
        assertSpaceScope(auth, space, {
          action,
          collection: write.collection,
        })
      }

      // @NOTE preserves the order of input.writes, for the response below.
      const prepared: PreparedWrite[] = await Promise.all(
        writes.map((write, i) => {
          const writeInfo = {
            did,
            space,
            collection: write.collection,
            validate,
            recordSchemaResolver: ctx.recordSchemaResolver,
            validationPath: ['writes', i, 'value'] as (string | number)[],
          }
          if (com.atproto.space.applyWrites.create.isTypeOf(write)) {
            return prepareCreate({
              ...writeInfo,
              rkey: write.rkey,
              record: write.value,
            })
          } else if (com.atproto.space.applyWrites.update.isTypeOf(write)) {
            return prepareUpdate({
              ...writeInfo,
              rkey: write.rkey,
              record: write.value,
            })
          } else if (com.atproto.space.applyWrites.delete.isTypeOf(write)) {
            return prepareDelete({ ...writeInfo, rkey: write.rkey })
          }
          throw new InvalidRequestError(
            `Action not supported: ${write['$type']}`,
          )
        }),
      )

      // Null for an empty batch: nothing was written, so there is nothing to notify.
      const commit = await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.space.applyWrites(space, prepared),
      )

      await fireNotifyWrite(ctx, { space, writerDid: did, commit })

      return {
        encoding: 'application/json' as const,
        body: { results: prepared.map(writeToResult) },
      }
    },
  })
}

const writeToResult = (write: PreparedWrite) => {
  const { createResult, updateResult, deleteResult } =
    com.atproto.space.applyWrites
  switch (write.action) {
    case WriteOpAction.Create:
      return createResult.build({
        uri: write.uri.toString(),
        cid: write.cid.toString(),
        validationStatus: write.validationStatus,
      })
    case WriteOpAction.Update:
      return updateResult.build({
        uri: write.uri.toString(),
        cid: write.cid.toString(),
        validationStatus: write.validationStatus,
      })
    case WriteOpAction.Delete:
      return deleteResult.build({})
  }
}

import {
  type LegacyBlobRef,
  type LexMap,
  type TypedBlobRef,
  isLegacyBlobRef,
  parseCid,
} from '@atproto/lex-data'
import { atUri } from '@atproto/lex-schema'
import { WriteOpAction } from '@atproto/repo'
import {
  AuthRequiredError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { ActorStoreTransactor } from '../../../../actor-store/actor-store-transactor.js'
import type { AppContext } from '../../../../context.js'
import { app, com } from '../../../../lexicons/index.js'
import { dbLogger } from '../../../../logger.js'
import {
  BadCommitSwapError,
  BadRecordSwapError,
  InvalidRecordError,
  type PreparedCreate,
  type PreparedUpdate,
  prepareCreate,
  prepareUpdate,
} from '../../../../repo/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.repo.putRecord, {
    auth: ctx.authVerifier.authorization({
      // @NOTE the "checkTakedown" and "checkDeactivated" checks are typically
      // performed during auth. However, since this method's "repo" parameter
      // can be a handle, we will need to fetch the account again to ensure that
      // the handle matches the DID from the request's credentials. In order to
      // avoid fetching the account twice (during auth, and then again in the
      // controller), the checks are disabled here:

      // checkTakedown: true,
      // checkDeactivated: true,
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

      const account = await ctx.authVerifier.findAccount(repo, {
        checkDeactivated: true,
        checkTakedown: true,
      })

      const did = account.did
      if (did !== auth.credentials.did) {
        throw new AuthRequiredError()
      }

      // We can't compute permissions based on the request payload ("input") in
      // the 'auth' phase, so we do it here.
      if (auth.credentials.type === 'oauth') {
        auth.credentials.permissions.assertRepo({
          action: 'create',
          collection,
        })
        auth.credentials.permissions.assertRepo({
          action: 'update',
          collection,
        })
      }

      const uri = atUri(did, collection, rkey)
      const swapCommitCid = swapCommit ? parseCid(swapCommit) : undefined
      const swapRecordCid =
        typeof swapRecord === 'string' ? parseCid(swapRecord) : swapRecord

      const writeInfo = {
        did,
        collection,
        rkey,
        record,
        swapCid: swapRecordCid,
        validate,
      }
      const prepare = async (
        isUpdate: boolean,
      ): Promise<PreparedCreate | PreparedUpdate> => {
        try {
          return isUpdate
            ? await prepareUpdate(writeInfo)
            : await prepareCreate(writeInfo)
        } catch (err) {
          if (err instanceof InvalidRecordError) {
            throw new InvalidRequestError(err.message)
          }
          throw err
        }
      }

      // Validate the record and move its blobs to permanent storage before
      // taking the actor db write lock. Legacy blob refs in a profile are
      // upgraded in the transaction, so such a record is prepared there.
      const prepared =
        collection === app.bsky.actor.profile.$type &&
        (isLegacyBlobRef(record.avatar) || isLegacyBlobRef(record.banner))
          ? undefined
          : await prepare(false)
      const permanentBlobs = prepared
        ? await ctx.actorStore.makeBlobsPermanent(did, prepared.blobs)
        : undefined

      const { commit, write } = await ctx.actorStore.transact(
        did,
        async (actorTxn) => {
          const current = await actorTxn.record.getRecord(uri, null, true)
          const isUpdate = current !== null

          // @TODO temporaray hack for legacy blob refs in profiles - remove after migrating legacy blobs
          if (isUpdate && collection === app.bsky.actor.profile.$type) {
            await updateProfileLegacyBlobRef(actorTxn, record)
          }

          // prepareCreate() and prepareUpdate() only differ in their action.
          const write: PreparedCreate | PreparedUpdate = !prepared
            ? await prepare(isUpdate)
            : isUpdate
              ? { ...prepared, action: WriteOpAction.Update }
              : prepared

          // no-op
          if (current && current.cid === write.cid.toString()) {
            return {
              commit: null,
              write,
            }
          }

          const commit = await actorTxn.repo
            .processWrites([write], swapCommitCid, permanentBlobs)
            .catch((err) => {
              if (
                err instanceof BadCommitSwapError ||
                err instanceof BadRecordSwapError
              ) {
                throw new InvalidRequestError(err.message, 'InvalidSwap')
              } else {
                throw err
              }
            })

          await ctx.sequencer.sequenceCommit(did, commit)

          return { commit, write }
        },
      )

      if (commit !== null) {
        await ctx.accountManager
          .updateRepoRoot(did, commit.cid, commit.rev)
          .catch((err) => {
            dbLogger.error(
              { err, did, cid: commit.cid, rev: commit.rev },
              'failed to update account root',
            )
          })
      }

      return {
        encoding: 'application/json',
        body: {
          uri: write.uri.toString(),
          cid: write.cid.toString(),
          commit: commit
            ? {
                cid: commit.cid.toString(),
                rev: commit.rev,
              }
            : undefined,
          validationStatus: write.validationStatus,
        },
      }
    },
  })
}

// WARNING: mutates object
async function updateProfileLegacyBlobRef(
  actorStore: ActorStoreTransactor,
  record: LexMap,
): Promise<void> {
  if (isLegacyBlobRef(record.avatar)) {
    record.avatar = await upgradeLegacyBlob(actorStore, record.avatar)
  }
  if (isLegacyBlobRef(record.banner)) {
    record.banner = await upgradeLegacyBlob(actorStore, record.banner)
  }
}

async function upgradeLegacyBlob(
  actorStore: ActorStoreTransactor,
  legacyBlob: LegacyBlobRef,
): Promise<TypedBlobRef> {
  const ref = parseCid(legacyBlob.cid)
  const blob = await actorStore.repo.blob.getBlobMetadata(ref)
  return {
    $type: 'blob',
    mimeType: legacyBlob.mimeType,
    ref,
    size: blob.size,
  }
}

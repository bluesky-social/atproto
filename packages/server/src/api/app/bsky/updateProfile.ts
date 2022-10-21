import { Server } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../locals'
import * as schema from '../../../lexicon/schemas'
import { AtUri } from '@atproto/uri'
import { RepoStructure } from '@atproto/repo'

const profileNsid = schema.ids.AppBskyProfile

export default function (server: Server) {
  server.app.bsky.updateProfile(async (_params, input, req, res) => {
    const { auth, db, blockstore } = locals.get(res)

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }
    const authStore = await locals.getAuthstore(res, requester)
    const uri = new AtUri(`${requester}/${profileNsid}/self`)

    const { profileCid, updated } = await db.transaction(async (txnDb) => {
      const currRoot = await txnDb.getRepoRoot(requester, true)
      if (!currRoot) {
        throw new Error('blah')
      }
      const repo = await RepoStructure.load(blockstore, currRoot)
      const current = await repo.getRecord(profileNsid, 'self')
      if (!db.records.profile.matchesSchema(current)) {
        // @TODO need a way to get a profile out of a broken state
        throw new InvalidRequestError('could not parse current profile')
      }

      const updated = {
        ...current,
        displayName: input.body.displayName || current.displayName,
        description: input.body.description || current.description,
        pinnedBadges: input.body.pinnedBadges || current.pinnedBadges,
      }
      if (!db.records.profile.matchesSchema(updated)) {
        throw new InvalidRequestError(
          'requested updates do not produce a valid profile doc',
        )
      }

      const currBadges = await txnDb.db
        .selectFrom('app_bsky_profile_badge')
        .selectAll()
        .where('profileUri', '=', uri.toString())
        .execute()

      const updatedBadges = updated.pinnedBadges || []
      const toDelete = currBadges
        .filter(
          (row) => !updatedBadges.some((badge) => badge.uri === row.badgeUri),
        )
        .map((row) => row.badgeUri)
      const toAdd = updatedBadges
        .filter(
          (badge) => !currBadges.some((row) => badge.uri === row.badgeUri),
        )
        .map((badge) => ({
          profileUri: uri.toString(),
          badgeUri: badge.uri,
          badgeCid: badge.cid,
        }))

      const profileCid = await repo.blockstore.put(updated)

      // Update profile record
      await txnDb.db
        .updateTable('record')
        .set({
          raw: JSON.stringify(updated),
          cid: profileCid.toString(),
          indexedAt: new Date().toISOString(),
        })
        .where('uri', '=', uri.toString())
        .execute()

      // Update profile app index
      await txnDb.db
        .updateTable('app_bsky_profile')
        .set({
          cid: profileCid.toString(),
          displayName: updated.displayName,
          description: updated.description,
          indexedAt: new Date().toISOString(),
        })
        .where('uri', '=', uri.toString())
        .execute()

      // Remove old badges
      if (toDelete.length > 0) {
        await txnDb.db
          .deleteFrom('app_bsky_profile_badge')
          .where('profileUri', '=', uri.toString())
          .where('badgeUri', 'in', toDelete)
          .execute()
      }

      // Add new badges
      if (toAdd.length > 0) {
        await txnDb.db
          .insertInto('app_bsky_profile_badge')
          .values(toAdd)
          .execute()
      }

      await repo
        .stageUpdate({
          action: 'update',
          collection: profileNsid,
          rkey: 'self',
          cid: profileCid,
        })
        .createCommit(authStore, async (prev, curr) => {
          const success = await txnDb.updateRepoRoot(requester, curr, prev)
          if (!success) {
            throw new Error('could not udpate')
          }
          return null
        })

      return { profileCid, updated }
    })

    return {
      encoding: 'application/json',
      body: {
        uri: uri.toString(),
        cid: profileCid.toString(),
        record: updated,
      },
    }
  })
}

// const updateProfileRetry = async (
//   db: Database,
//   blockstore: IpldStore,
//   authStore: auth.AuthStore,
//   userDid: string,
//   input: HandlerInput,
//   attempts = 5,
// ): Promise<OutputSchema> => {
//   for (let i = 0; i < attempts; i++) {
//     try {
//       const res = await attemptProfileUpdate(
//         db,
//         blockstore,
//         authStore,
//         userDid,
//         input,
//       )
//       return res
//     } catch (err) {
//       if (err instanceof TransactionError) {
//         continue
//       } else {
//         throw err
//       }
//     }
//   }

//   throw new Error(`attempted ${attempts} times`)
// }

// const attemptProfileUpdate = async (
//   db: Database,
//   blockstore: IpldStore,
//   authStore: auth.AuthStore,
//   userDid: string,
//   input: HandlerInput,
// ): Promise<OutputSchema> => {}

// class TransactionError extends Error {}

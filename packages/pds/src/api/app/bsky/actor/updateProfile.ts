import { Server } from '../../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../../locals'
import * as lexicons from '../../../../lexicon/lexicons'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Profile from '../../../../lexicon/types/app/bsky/actor/profile'
import * as common from '@atproto/common'
import * as repo from '../../../../repo'
import ServerAuth from '../../../../auth'

const profileNsid = lexicons.ids.AppBskyActorProfile

export default function (server: Server) {
  server.app.bsky.actor.updateProfile({
    auth: ServerAuth.verifier,
    handler: async ({ auth, input, res }) => {
      const { db, blobstore } = locals.get(res)
      const requester = auth.credentials.did

      const did = input.body.did || requester
      const authorized = await db.isUserControlledRepo(did, requester)
      if (!authorized) {
        throw new AuthRequiredError()
      }
      const authStore = await locals.getAuthstore(res, did)
      const uri = new AtUri(`${did}/${profileNsid}/self`)

      const { profileCid, updated } = await db.transaction(
        async (
          dbTxn,
        ): Promise<{ profileCid: CID; updated: Profile.Record }> => {
          const now = new Date().toISOString()

          let updated
          const uri = AtUri.make(did, profileNsid, 'self')
          const current = (await dbTxn.getRecord(uri, null))?.value
          if (current) {
            if (!db.records.profile.matchesSchema(current)) {
              // @TODO need a way to get a profile out of a broken state
              throw new InvalidRequestError('could not parse current profile')
            }

            updated = {
              ...current,
              displayName: input.body.displayName || current.displayName,
              description: input.body.description || current.description,
              avatar: input.body.avatar || current.avatar,
              banner: input.body.banner || current.banner,
            }
          } else {
            updated = {
              $type: profileNsid,
              displayName: input.body.displayName,
              description: input.body.description,
              avatar: input.body.avatar,
              banner: input.body.banner,
            }
          }
          updated = common.noUndefinedVals(updated)
          if (!db.records.profile.matchesSchema(updated)) {
            throw new InvalidRequestError(
              'requested updates do not produce a valid profile doc',
            )
          }

          const writes = await repo.prepareWrites(did, {
            action: current ? 'update' : 'create',
            collection: profileNsid,
            rkey: 'self',
            value: updated,
          })

          const commit = await repo.writeToRepo(
            dbTxn,
            did,
            authStore,
            writes,
            now,
          )
          await repo.processWriteBlobs(dbTxn, blobstore, did, commit, writes)

          const write = writes[0]
          let profileCid: CID
          if (write.action === 'update') {
            profileCid = write.cid
            // Update profile record
            await dbTxn.db
              .updateTable('record')
              .set({ cid: profileCid.toString() })
              .where('uri', '=', uri.toString())
              .execute()

            // Update profile app index
            await dbTxn.db
              .updateTable('profile')
              .set({
                cid: profileCid.toString(),
                displayName: updated.displayName,
                description: updated.description,
                avatarCid: updated.avatar?.cid,
                bannerCid: updated.banner?.cid,
                indexedAt: now,
              })
              .where('uri', '=', uri.toString())
              .execute()
          } else if (write.action === 'create') {
            profileCid = write.cid
            await dbTxn.indexRecord(uri, profileCid, updated, now)
          } else {
            // should never hit this
            throw new Error(
              `Unsupported action on update profile: ${write.action}`,
            )
          }

          return { profileCid, updated }
        },
      )

      return {
        encoding: 'application/json',
        body: {
          uri: uri.toString(),
          cid: profileCid.toString(),
          record: updated,
        },
      }
    },
  })
}

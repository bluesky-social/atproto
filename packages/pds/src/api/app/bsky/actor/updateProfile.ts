import { Server } from '../../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as lexicons from '../../../../lexicon/lexicons'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Profile from '../../../../lexicon/types/app/bsky/actor/profile'
import * as common from '@atproto/common'
import * as repo from '../../../../repo'
import AppContext from '../../../../context'

const profileNsid = lexicons.ids.AppBskyActorProfile

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.updateProfile({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did

      const did = input.body.did || requester
      const authorized = await ctx.services
        .repo(ctx.db)
        .isUserControlledRepo(did, requester)
      if (!authorized) {
        throw new AuthRequiredError()
      }
      const authStore = await ctx.getAuthstore(did)
      const uri = new AtUri(`${did}/${profileNsid}/self`)

      const { profileCid, updated } = await ctx.db.transaction(
        async (
          dbTxn,
        ): Promise<{ profileCid: CID; updated: Profile.Record }> => {
          const recordTxn = ctx.services.record(dbTxn)
          const repoTxn = ctx.services.repo(dbTxn)
          const now = new Date().toISOString()

          let updated
          const uri = AtUri.make(did, profileNsid, 'self')
          const current = (await recordTxn.getRecord(uri, null))?.value
          if (current) {
            if (!recordTxn.records.profile.matchesSchema(current)) {
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
          if (!recordTxn.records.profile.matchesSchema(updated)) {
            throw new InvalidRequestError(
              'requested updates do not produce a valid profile doc',
            )
          }

          const write = current
            ? await repo.prepareUpdate({
                did,
                collection: profileNsid,
                rkey: 'self',
                record: updated,
              })
            : await repo.prepareCreate({
                did,
                collection: profileNsid,
                record: updated,
              })

          const commit = await repoTxn.writeToRepo(did, authStore, [write], now)
          await repoTxn.blobs.processWriteBlobs(did, commit, [write])

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
            await recordTxn.indexRecord(uri, profileCid, updated, now)
          } else {
            const exhaustiveCheck: never = write
            throw new Error(
              `Unsupported action on update profile: ${exhaustiveCheck}`,
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

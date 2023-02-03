import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as lexicons from '../../../../lexicon/lexicons'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Profile from '../../../../lexicon/types/app/bsky/actor/profile'
import * as common from '@atproto/common'
import * as repo from '../../../../repo'
import AppContext from '../../../../context'
import { WriteOpAction } from '@atproto/repo'

const profileNsid = lexicons.ids.AppBskyActorProfile

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.updateProfile({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
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
          const current = (await recordTxn.getRecord(uri, null, true))?.value
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

          const profileCid = write.cid
          await repoTxn.processWrites(did, [write], now, async () => {
            if (write.action === WriteOpAction.Update) {
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
            } else if (write.action === WriteOpAction.Create) {
              await recordTxn.indexRecord(uri, profileCid, updated, now)
            } else {
              const exhaustiveCheck: never = write
              throw new Error(
                `Unsupported action on update profile: ${exhaustiveCheck}`,
              )
            }
          })
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

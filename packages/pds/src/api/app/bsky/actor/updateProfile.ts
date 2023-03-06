import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
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
            if (!isProfile(current)) {
              // @TODO need a way to get a profile out of a broken state
              throw new InvalidRequestError('could not parse current profile')
            }
            updated = {
              ...current,
              displayName: input.body.displayName || current.displayName,
              description: unsetIfNull(
                input.body.description,
                current.description,
              ),
              avatar: unsetIfNull(input.body.avatar, current.avatar),
              banner: unsetIfNull(input.body.banner, current.banner),
            }
          } else {
            updated = {
              $type: profileNsid,
              displayName: input.body.displayName,
              description: unsetIfNull(input.body.description),
              avatar: unsetIfNull(input.body.avatar),
              banner: unsetIfNull(input.body.banner),
            }
          }
          updated = common.noUndefinedVals(updated)
          if (!isProfile(updated)) {
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
          await repoTxn.processWrites(did, [write], now)
          return { profileCid: write.cid, updated }
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

function unsetIfNull<T>(x: T | null | undefined, y?: T): T | undefined {
  if (x === null) return undefined
  return x ?? y
}

function isProfile(obj: unknown): obj is Profile.Record {
  return Profile.validateRecord(obj).success
}

import { Server } from '../../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../../locals'
import * as lexicons from '../../../../lexicon/lexicons'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Profile from '../../../../lexicon/types/app/bsky/actor/profile'
import * as common from '@atproto/common'
import * as repoUtil from '../../../../util/repo'

const profileNsid = lexicons.ids.AppBskyActorProfile

export default function (server: Server) {
  server.app.bsky.actor.updateProfile(async (_params, input, req, res) => {
    const { auth, db } = locals.get(res)

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }
    const did = input.body.did || requester
    const authorized = await db.isUserControlledRepo(did, requester)
    if (!authorized) {
      throw new AuthRequiredError()
    }
    const authStore = await locals.getAuthstore(res, did)
    const uri = new AtUri(`${did}/${profileNsid}/self`)

    const { profileCid, updated } = await db.transaction(
      async (dbTxn): Promise<{ profileCid: CID; updated: Profile.Record }> => {
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
          }
        } else {
          updated = {
            $type: profileNsid,
            displayName: input.body.displayName,
            description: input.body.description,
          }
        }
        updated = common.noUndefinedVals(updated)
        if (!db.records.profile.matchesSchema(updated)) {
          throw new InvalidRequestError(
            'requested updates do not produce a valid profile doc',
          )
        }

        const writes = await repoUtil.prepareWrites(did, {
          action: current ? 'update' : 'create',
          collection: profileNsid,
          rkey: 'self',
          value: updated,
        })

        await repoUtil.writeToRepo(dbTxn, did, authStore, writes, now)

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
  })
}

import { Server } from '../../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../../locals'
import * as schema from '../../../../lexicon/schemas'
import { AtUri } from '@atproto/uri'
import { RepoStructure } from '@atproto/repo'
import SqlBlockstore from '../../../../sql-blockstore'
import { CID } from 'multiformats/cid'
import * as Profile from '../../../../lexicon/types/app/bsky/actor/profile'
import * as common from '@atproto/common'

const profileNsid = schema.ids.AppBskyActorProfile

export default function (server: Server) {
  server.app.bsky.actor.updateProfile(async (_params, input, req, res) => {
    const { auth, db, logger } = locals.get(res)

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
        const currRoot = await dbTxn.getRepoRoot(did, true)
        if (!currRoot) {
          throw new InvalidRequestError(
            `${did} is not a registered repo on this server`,
          )
        }
        const now = new Date().toISOString()
        const blockstore = new SqlBlockstore(dbTxn, did, now)
        const repo = await RepoStructure.load(blockstore, currRoot)

        let updated
        const current = await repo.getRecord(profileNsid, 'self')
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

        const profileCid = await repo.blockstore.put(updated)

        if (current) {
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
        } else {
          await dbTxn.indexRecord(uri, profileCid, updated, now)
        }

        await repo
          .stageUpdate({
            action: current ? 'update' : 'create',
            collection: profileNsid,
            rkey: 'self',
            cid: profileCid,
          })
          .createCommit(authStore, async (prev, curr) => {
            const success = await dbTxn.updateRepoRoot(did, curr, prev)
            if (!success) {
              logger.error({ did, curr, prev }, 'repo update failed')
              throw new Error('Could not update repo root')
            }
            return null
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
  })
}

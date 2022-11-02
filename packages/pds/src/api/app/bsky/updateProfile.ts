import { Server } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../locals'
import * as schema from '../../../lexicon/schemas'
import { AtUri } from '@atproto/uri'
import { RepoStructure } from '@atproto/repo'
import SqlBlockstore from '../../../sql-blockstore'
import { CID } from 'multiformats/cid'
import * as Profile from '../../../lexicon/types/app/bsky/profile'

const profileNsid = schema.ids.AppBskyProfile

export default function (server: Server) {
  server.app.bsky.updateProfile(async (_params, input, req, res) => {
    const { auth, db, logger } = locals.get(res)

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }
    const authStore = await locals.getAuthstore(res, requester)
    const uri = new AtUri(`${requester}/${profileNsid}/self`)

    const { profileCid, updated } = await db.transaction(
      async (dbTxn): Promise<{ profileCid: CID; updated: Profile.Record }> => {
        const currRoot = await dbTxn.getRepoRoot(requester, true)
        if (!currRoot) {
          throw new InvalidRequestError(
            `${requester} is not a registered repo on this server`,
          )
        }
        const now = new Date().toISOString()
        const blockstore = new SqlBlockstore(dbTxn, requester, now)
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
        }
        if (!db.records.profile.matchesSchema(updated)) {
          throw new InvalidRequestError(
            'requested updates do not produce a valid profile doc',
          )
        }

        const profileCid = await repo.blockstore.put(updated)

        // Update profile record
        await dbTxn.db
          .updateTable('record')
          .set({ cid: profileCid.toString() })
          .where('uri', '=', uri.toString())
          .execute()

        // Update profile app index
        await dbTxn.db
          .updateTable('app_bsky_profile')
          .set({
            cid: profileCid.toString(),
            displayName: updated.displayName,
            description: updated.description,
            indexedAt: now,
          })
          .where('uri', '=', uri.toString())
          .execute()

        await repo
          .stageUpdate({
            action: 'update',
            collection: profileNsid,
            rkey: 'self',
            cid: profileCid,
          })
          .createCommit(authStore, async (prev, curr) => {
            const success = await dbTxn.updateRepoRoot(requester, curr, prev)
            if (!success) {
              logger.error({ did: requester, curr, prev }, 'repo update failed')
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

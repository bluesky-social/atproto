import { Server } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@adxp/xrpc-server'
import * as locals from '../../../locals'
import { AdxUri } from '@adxp/uri'

const profileNsid = 'app.bsky.profile'

export default function (server: Server) {
  server.app.bsky.updateProfile(async (_params, input, req, res) => {
    const { auth, db } = locals.get(res)

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }

    const repo = await locals.loadRepo(res, requester)
    if (!repo) {
      throw new InvalidRequestError(
        `${requester} is not a registered repo on this server`,
      )
    }

    const current = await repo.getCollection(profileNsid).getRecord('self')
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

    const uri = new AdxUri(`${requester}/${profileNsid}/self`)

    const currBadges = await db.db
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
      .filter((badge) => !currBadges.some((row) => badge.uri === row.badgeUri))
      .map((badge) => ({
        profileUri: uri.toString(),
        badgeUri: badge.uri,
        badgeCid: badge.cid,
      }))

    const newCid = await db.transaction(async (txnDb) => {
      // Update repo
      const newCid = await repo
        .getCollection(profileNsid)
        .updateRecord('self', updated)

      // Update profile record
      await txnDb.db
        .updateTable('record')
        .set({
          raw: JSON.stringify(updated),
          cid: newCid.toString(),
          indexedAt: new Date().toISOString(),
        })
        .where('uri', '=', uri.toString())
        .execute()

      // Update profile app index
      await txnDb.db
        .updateTable('app_bsky_profile')
        .set({
          cid: newCid.toString(),
          displayName: updated.displayName,
          description: updated.description,
          indexedAt: new Date().toISOString(),
        })
        .where('uri', '=', uri.toString())
        .execute()

      // Remove old badges
      await txnDb.db
        .deleteFrom('app_bsky_profile_badge')
        .where('profileUri', '=', uri.toString())
        .where('badgeUri', 'in', toDelete)
        .execute()

      // Add new badges
      await txnDb.db
        .insertInto('app_bsky_profile_badge')
        .values(toAdd)
        .execute()

      // Index repo root
      await txnDb.updateRepoRoot(requester, repo.cid)

      return newCid
    })

    return {
      encoding: 'application/json',
      body: {
        uri: uri.toString(),
        cid: newCid.toString(),
        record: updated,
      },
    }
  })
}

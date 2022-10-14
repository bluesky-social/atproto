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
      badges: input.body.badges || current.badges,
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

    const updatedBadges = updated.badges || []
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

    const newCid = await repo
      .getCollection(profileNsid)
      .updateRecord('self', updated)

    const recordQuery = db.db
      .updateTable('record')
      .set({
        raw: JSON.stringify(updated),
        cid: newCid.toString(),
        indexedAt: new Date().toISOString(),
      })
      .where('uri', '=', uri.toString())
      .execute()

    const profileQuery = db.db
      .updateTable('app_bsky_profile')
      .set({
        cid: newCid.toString(),
        displayName: updated.displayName,
        description: updated.description,
        indexedAt: new Date().toISOString(),
      })
      .where('uri', '=', uri.toString())
      .execute()

    const delBadgesQuery = db.db
      .deleteFrom('app_bsky_profile_badge')
      .where('profileUri', '=', uri.toString())
      .where('badgeUri', 'in', toDelete)
      .execute()

    const addBadgesQuery = db.db
      .insertInto('app_bsky_profile_badge')
      .values(toAdd)
      .execute()

    // @TODO transactionalize
    await Promise.all([
      recordQuery,
      profileQuery,
      delBadgesQuery,
      addBadgesQuery,
      db.updateRepoRoot(requester, repo.cid),
    ])

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

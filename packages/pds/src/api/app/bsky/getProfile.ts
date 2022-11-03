import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import * as GetProfile from '../../../lexicon/types/app/bsky/getProfile'
import { countAll, userWhereClause } from '../../../db/util'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.app.bsky.getProfile(
    async (params: GetProfile.QueryParams, _input, req, res) => {
      const { user } = params
      const { auth, db } = locals.get(res)

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const { ref } = db.db.dynamic

      const queryRes = await db.db
        .selectFrom('user_did')
        .where(userWhereClause(user))
        .leftJoin(
          'app_bsky_profile as profile',
          'profile.creator',
          'user_did.did',
        )
        .select([
          'user_did.did as did',
          'user_did.handle as handle',
          'profile.uri as profileUri',
          'profile.displayName as displayName',
          'profile.description as description',
          db.db
            .selectFrom('app_bsky_follow')
            .whereRef('creator', '=', ref('user_did.did'))
            .select(countAll.as('count'))
            .as('followsCount'),
          db.db
            .selectFrom('app_bsky_follow')
            .whereRef('subjectDid', '=', ref('user_did.did'))
            .select(countAll.as('count'))
            .as('followersCount'),
          db.db
            .selectFrom('app_bsky_post')
            .whereRef('creator', '=', ref('user_did.did'))
            .select(countAll.as('count'))
            .as('postsCount'),
          db.db
            .selectFrom('app_bsky_follow')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('user_did.did'))
            .select('uri')
            .as('requesterFollow'),
        ])
        .executeTakeFirst()

      if (!queryRes) {
        throw new InvalidRequestError(`Profile not found`)
      }

      return {
        encoding: 'application/json',
        body: {
          did: queryRes.did,
          handle: queryRes.handle,
          displayName: queryRes.displayName || undefined,
          description: queryRes.description || undefined,
          followsCount: queryRes.followsCount,
          followersCount: queryRes.followersCount,
          postsCount: queryRes.postsCount,
          myState: {
            follow: queryRes.requesterFollow || undefined,
          },
        },
      }
    },
  )
}

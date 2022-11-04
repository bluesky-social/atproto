import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import * as GetProfile from '../../../../lexicon/types/app/bsky/actor/getProfile'
import { countAll, actorWhereClause } from '../../../../db/util'
import * as locals from '../../../../locals'

export default function (server: Server) {
  server.app.bsky.actor.getProfile(
    async (params: GetProfile.QueryParams, _input, req, res) => {
      const { actor } = params
      const { auth, db } = locals.get(res)

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const { ref } = db.db.dynamic

      const queryRes = await db.db
        .selectFrom('did_handle')
        .where(actorWhereClause(actor))
        .leftJoin(
          'app_bsky_profile as profile',
          'profile.creator',
          'did_handle.did',
        )
        .leftJoin('scene', 'scene.handle', 'did_handle.handle')
        .select([
          'did_handle.did as did',
          'did_handle.handle as handle',
          'scene.owner as owner',
          'profile.uri as profileUri',
          'profile.displayName as displayName',
          'profile.description as description',
          db.db
            .selectFrom('app_bsky_follow')
            .whereRef('creator', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('followsCount'),
          db.db
            .selectFrom('app_bsky_follow')
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('followersCount'),
          db.db
            .selectFrom('app_bsky_assertion as assertion')
            .innerJoin(
              'app_bsky_confirmation as confirmation',
              'confirmation.assertionUri',
              'assertion.uri',
            )
            .whereRef('assertion.creator', '=', ref('did_handle.did'))
            .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
            .whereRef('confirmation.assertionCid', '=', ref('assertion.cid'))
            .select(countAll.as('count'))
            .as('membersCount'),
          db.db
            .selectFrom('app_bsky_post')
            .whereRef('creator', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('postsCount'),
          db.db
            .selectFrom('app_bsky_follow')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
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
          creator: queryRes.owner || queryRes.did,
          displayName: queryRes.displayName || undefined,
          description: queryRes.description || undefined,
          followsCount: queryRes.followsCount,
          followersCount: queryRes.followersCount,
          membersCount: queryRes.membersCount,
          postsCount: queryRes.postsCount,
          myState: {
            follow: queryRes.requesterFollow || undefined,
          },
        },
      }
    },
  )
}

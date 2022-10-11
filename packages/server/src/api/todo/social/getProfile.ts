import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@adxp/xrpc-server'
import * as GetProfile from '../../../lexicon/types/todo/social/getProfile'
import { countClause, userWhereClause } from '../../../db/util'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.todo.social.getProfile(
    async (params: GetProfile.QueryParams, _input, req, res) => {
      const { user } = params
      const { auth, db } = locals.get(res)

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const { ref } = db.db.dynamic

      const queryRes = await db.db
        .selectFrom('user')
        .where(userWhereClause(user))
        .leftJoin(
          'todo_social_profile as profile',
          'profile.creator',
          'user.did',
        )
        .select([
          'user.did as did',
          'user.username as name',
          'profile.displayName as displayName',
          'profile.description as description',
          db.db
            .selectFrom('todo_social_follow')
            .whereRef('creator', '=', ref('user.did'))
            .select(countClause.as('count'))
            .as('followsCount'),
          db.db
            .selectFrom('todo_social_follow')
            .whereRef('subject', '=', ref('user.did'))
            .select(countClause.as('count'))
            .as('followersCount'),
          db.db
            .selectFrom('todo_social_post')
            .whereRef('creator', '=', ref('user.did'))
            .select(countClause.as('count'))
            .as('postsCount'),
          db.db
            .selectFrom('todo_social_follow')
            .where('creator', '=', requester)
            .whereRef('subject', '=', ref('user.did'))
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
          name: queryRes.name,
          displayName: queryRes.displayName || undefined,
          description: queryRes.description || undefined,
          followsCount: queryRes.followsCount,
          followersCount: queryRes.followersCount,
          postsCount: queryRes.postsCount,
          badges: [], // @TODO map this when implementing badging
          myState: {
            follow: queryRes.requesterFollow || undefined,
          },
        },
      }
    },
  )
}

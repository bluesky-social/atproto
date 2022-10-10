import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@adxp/xrpc-server'
import * as GetProfile from '../../../lexicon/types/todo/social/getProfile'
import * as util from '../../../db/util'
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

      const queryRes = await db.db
        .selectFrom('user')
        .where(util.userWhereClause(user))
        .leftJoin(
          'todo_social_profile as profile',
          'profile.creator',
          'user.did',
        )
        .leftJoin(
          db.db
            .selectFrom('todo_social_follow')
            .select([
              'todo_social_follow.creator as subject',
              db.db.fn.count<number>('todo_social_follow.uri').as('count'),
            ])
            .groupBy('subject')
            .as('follows_count'),
          'follows_count.subject',
          'user.did',
        )
        .leftJoin(
          db.db
            .selectFrom('todo_social_follow')
            .select([
              'todo_social_follow.subject as subject',
              db.db.fn.count<number>('todo_social_follow.uri').as('count'),
            ])
            .groupBy('subject')
            .as('followers_count'),
          'followers_count.subject',
          'user.did',
        )
        .leftJoin(
          db.db
            .selectFrom('todo_social_post')
            .select([
              'todo_social_post.creator as subject',
              db.db.fn.count<number>('todo_social_post.uri').as('count'),
            ])
            .groupBy('subject')
            .as('posts_count'),
          'posts_count.subject',
          'user.did',
        )
        .leftJoin('todo_social_follow as requester_follow', (join) =>
          join
            .on('requester_follow.creator', '=', requester)
            .onRef('requester_follow.subject', '=', 'user.did'),
        )
        .select([
          'user.did as did',
          'user.username as name',
          'profile.displayName as displayName',
          'profile.description as description',
          'follows_count.count as followsCount',
          'followers_count.count as followersCount',
          'posts_count.count as postsCount',
          'requester_follow.uri as requesterFollow',
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
          followsCount: queryRes.followsCount || 0,
          followersCount: queryRes.followersCount || 0,
          postsCount: queryRes.postsCount || 0,
          badges: [], // @TODO map this when implementing badging
          myState: {
            follow: queryRes.requesterFollow || undefined,
          },
        },
      }
    },
  )
}

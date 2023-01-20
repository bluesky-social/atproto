import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { countAll, actorWhereClause, softDeleted } from '../../../../db/util'
import { getDeclarationSimple } from '../util'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const { actor } = params
      const requester = auth.credentials.did

      const db = ctx.db.db
      const { ref } = db.dynamic

      const queryRes = await db
        .selectFrom('did_handle')
        .where(actorWhereClause(actor))
        .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .select([
          'repo_root.takedownId',
          'did_handle.did as did',
          'did_handle.handle as handle',
          'did_handle.actorType as actorType',
          'did_handle.declarationCid as declarationCid',
          'profile.uri as profileUri',
          'profile.displayName as displayName',
          'profile.description as description',
          'profile.avatarCid as avatarCid',
          'profile.bannerCid as bannerCid',
          db
            .selectFrom('follow')
            .whereRef('creator', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('followsCount'),
          db
            .selectFrom('follow')
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('followersCount'),
          db
            .selectFrom('post')
            .whereRef('creator', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('postsCount'),
          db
            .selectFrom('follow')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterFollow'),
          db
            .selectFrom('mute')
            .whereRef('did', '=', ref('did_handle.did'))
            .where('mutedByDid', '=', requester)
            .select('did')
            .as('requesterMuted'),
        ])
        .executeTakeFirst()

      if (!queryRes) {
        throw new InvalidRequestError(`Profile not found`)
      }
      if (softDeleted(queryRes)) {
        throw new InvalidRequestError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      const avatar = queryRes.avatarCid
        ? ctx.imgUriBuilder.getCommonSignedUri('avatar', queryRes.avatarCid)
        : undefined

      const banner = queryRes.bannerCid
        ? ctx.imgUriBuilder.getCommonSignedUri('banner', queryRes.bannerCid)
        : undefined

      return {
        encoding: 'application/json',
        body: {
          did: queryRes.did,
          declaration: getDeclarationSimple(queryRes),
          handle: queryRes.handle,
          creator: queryRes.did,
          displayName: queryRes.displayName || undefined,
          description: queryRes.description || undefined,
          avatar: avatar,
          banner: banner,
          followsCount: queryRes.followsCount,
          followersCount: queryRes.followersCount,
          postsCount: queryRes.postsCount,
          myState: {
            follow: queryRes.requesterFollow || undefined,
            muted: !!queryRes.requesterMuted,
          },
        },
      }
    },
  })
}

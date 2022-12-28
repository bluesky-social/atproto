import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { countAll, actorWhereClause } from '../../../../db/util'
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
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .leftJoin('scene', 'scene.handle', 'did_handle.handle')
        .select([
          'did_handle.did as did',
          'did_handle.handle as handle',
          'did_handle.actorType as actorType',
          'did_handle.declarationCid as declarationCid',
          'scene.owner as owner',
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
            .selectFrom('assertion')
            .whereRef('assertion.creator', '=', ref('did_handle.did'))
            .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
            .where('assertion.confirmUri', 'is not', null)
            .select(countAll.as('count'))
            .as('membersCount'),
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
            .selectFrom('assertion')
            .whereRef('creator', '=', ref('did_handle.did'))
            .where('assertion', '=', APP_BSKY_GRAPH.AssertMember)
            .where('confirmUri', 'is not', null)
            .where('subjectDid', '=', requester)
            .select('confirmUri')
            .as('requesterMember'),
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
          creator: queryRes.owner || queryRes.did,
          displayName: queryRes.displayName || undefined,
          description: queryRes.description || undefined,
          avatar: avatar,
          banner: banner,
          followsCount: queryRes.followsCount,
          followersCount: queryRes.followersCount,
          membersCount: queryRes.membersCount,
          postsCount: queryRes.postsCount,
          myState: {
            follow: queryRes.requesterFollow || undefined,
            member: queryRes.requesterMember || undefined,
            muted: !!queryRes.requesterMuted,
          },
        },
      }
    },
  })
}

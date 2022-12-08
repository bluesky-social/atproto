import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { countAll, actorWhereClause } from '../../../../db/util'
import * as locals from '../../../../locals'
import { getDeclarationSimple } from '../util'
import ServerAuth from '../../../../auth'
import { CID } from 'multiformats/cid'

export default function (server: Server) {
  server.app.bsky.actor.getProfile({
    auth: ServerAuth.verifier,
    handler: async ({ auth, params, res }) => {
      const { actor } = params
      const { db, imgUriBuilder } = locals.get(res)
      const requester = auth.credentials.did

      const { ref } = db.db.dynamic

      const queryRes = await db.db
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
          db.db
            .selectFrom('follow')
            .whereRef('creator', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('followsCount'),
          db.db
            .selectFrom('follow')
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('followersCount'),
          db.db
            .selectFrom('assertion')
            .whereRef('assertion.creator', '=', ref('did_handle.did'))
            .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
            .where('assertion.confirmUri', 'is not', null)
            .select(countAll.as('count'))
            .as('membersCount'),
          db.db
            .selectFrom('post')
            .whereRef('creator', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('postsCount'),
          db.db
            .selectFrom('follow')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterFollow'),
          db.db
            .selectFrom('assertion')
            .whereRef('creator', '=', ref('did_handle.did'))
            .where('assertion', '=', APP_BSKY_GRAPH.AssertMember)
            .where('confirmUri', 'is not', null)
            .where('subjectDid', '=', requester)
            .select('confirmUri')
            .as('requesterMember'),
        ])
        .executeTakeFirst()

      if (!queryRes) {
        throw new InvalidRequestError(`Profile not found`)
      }

      const avatar = queryRes.avatarCid
        ? imgUriBuilder.getSignedUri({
            cid: CID.parse(queryRes.avatarCid),
            format: 'jpeg',
            fit: 'cover',
            height: 250,
            width: 250,
            min: true,
          })
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
          followsCount: queryRes.followsCount,
          followersCount: queryRes.followersCount,
          membersCount: queryRes.membersCount,
          postsCount: queryRes.postsCount,
          myState: {
            follow: queryRes.requesterFollow || undefined,
            member: queryRes.requesterMember || undefined,
          },
        },
      }
    },
  })
}

import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { getActorInfo, getDeclarationSimple } from '../util'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollowers({
    auth: ctx.accessVerifier,
    handler: async ({ params }) => {
      const { user, limit, before } = params
      const { ref } = ctx.db.db.dynamic

      const subject = await getActorInfo(
        ctx.db.db,
        ctx.imgUriBuilder,
        user,
      ).catch((_e) => {
        throw new InvalidRequestError(`User not found: ${user}`)
      })

      let followersReq = ctx.db.db
        .selectFrom('follow')
        .where('follow.subjectDid', '=', subject.did)
        .innerJoin('did_handle as creator', 'creator.did', 'follow.creator')
        .innerJoin(
          'repo_root as creator_repo',
          'creator_repo.did',
          'follow.creator',
        )
        .where(notSoftDeletedClause(ref('creator_repo')))
        .leftJoin('profile', 'profile.creator', 'follow.creator')
        .select([
          'creator.did as did',
          'creator.declarationCid as declarationCid',
          'creator.actorType as actorType',
          'creator.handle as handle',
          'profile.displayName as displayName',
          'profile.avatarCid as avatarCid',
          'follow.cid as cid',
          'follow.createdAt as createdAt',
          'follow.indexedAt as indexedAt',
        ])

      const keyset = new TimeCidKeyset(
        ref('follow.createdAt'),
        ref('follow.cid'),
      )
      followersReq = paginate(followersReq, {
        limit,
        before,
        keyset,
      })

      const followersRes = await followersReq.execute()
      const followers = followersRes.map((row) => ({
        did: row.did,
        declaration: getDeclarationSimple(row),
        handle: row.handle,
        displayName: row.displayName || undefined,
        avatar: row.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject,
          followers,
          cursor: keyset.packFromResult(followersRes),
        },
      }
    },
  })
}

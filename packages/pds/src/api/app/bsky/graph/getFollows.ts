import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { getActorInfo, getDeclarationSimple } from '../util'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollows({
    auth: ctx.accessVerifier,
    handler: async ({ params }) => {
      const { user, limit, before } = params
      const { ref } = ctx.db.db.dynamic

      const creator = await getActorInfo(
        ctx.db.db,
        ctx.imgUriBuilder,
        user,
      ).catch((_e) => {
        throw new InvalidRequestError(`User not found: ${user}`)
      })

      let followsReq = ctx.db.db
        .selectFrom('follow')
        .where('follow.creator', '=', creator.did)
        .innerJoin('did_handle as subject', 'subject.did', 'follow.subjectDid')
        .innerJoin(
          'repo_root as subject_repo',
          'subject_repo.did',
          'follow.subjectDid',
        )
        .where(notSoftDeletedClause(ref('subject_repo')))
        .leftJoin('profile', 'profile.creator', 'follow.subjectDid')
        .select([
          'subject.did as did',
          'subject.declarationCid as declarationCid',
          'subject.actorType as actorType',
          'subject.handle as handle',
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
      followsReq = paginate(followsReq, {
        limit,
        before,
        keyset,
      })

      const followsRes = await followsReq.execute()
      const follows = followsRes.map((row) => ({
        did: row.did,
        declaration: getDeclarationSimple(row),
        handle: row.handle,
        displayName: row.displayName ?? undefined,
        avatar: row.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject: creator,
          follows,
          cursor: keyset.packFromResult(followsRes),
        },
      }
    },
  })
}
